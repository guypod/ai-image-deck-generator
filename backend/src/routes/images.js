import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { generateImagesSchema, tweakImageSchema } from '../models/Slide.js';
import * as fileSystem from '../services/fileSystem.js';
import * as googleImagen from '../services/googleImagen.js';
import * as openaiDalle from '../services/openaiDalle.js';
import * as imageProcessor from '../services/imageProcessor.js';
import { buildFullPrompt } from '../utils/promptParser.js';
import { executeInParallel } from '../utils/asyncPool.js';

const router = express.Router();

// Job storage (in-memory for now)
const jobs = new Map();

// Cleanup old jobs after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of jobs.entries()) {
    if (new Date(job.createdAt).getTime() < oneHourAgo) {
      jobs.delete(jobId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

/**
 * POST /api/decks/:deckId/slides/:slideId/generate
 * Generate images for a slide
 */
router.post(
  '/decks/:deckId/slides/:slideId/generate',
  validate(generateImagesSchema),
  asyncHandler(async (req, res) => {
    const { deckId, slideId } = req.params;
    const { count, service } = req.body;

    // Get deck and slide
    const deck = await fileSystem.getDeck(deckId);
    const slide = await fileSystem.getSlide(deckId, slideId);

    // Build full prompt
    const { prompt, unknownEntities } = buildFullPrompt(
      deck.visualStyle,
      slide.imageDescription,
      deck.entities
    );

    // Warn about unknown entities
    if (unknownEntities.length > 0) {
      console.warn(`Unknown entities in slide ${slideId}:`, unknownEntities);
    }

    // Generate images in parallel
    const tasks = Array.from({ length: count }, () => async () => {
      let imageBuffer;

      if (service === 'google-imagen') {
        imageBuffer = await googleImagen.generateImage(prompt, '16:9');
      } else if (service === 'openai-dalle') {
        imageBuffer = await openaiDalle.generateImage(prompt);
      } else {
        throw new Error(`Unknown service: ${service}`);
      }

      // Process image (enforce 16:9, convert to JPEG, optimize)
      const processedBuffer = await imageProcessor.processImage(imageBuffer);

      // Save to file system
      const imageMetadata = await fileSystem.addGeneratedImage(deckId, slideId, processedBuffer, {
        id: uuidv4(),
        service,
        prompt
      });

      return imageMetadata;
    });

    const results = await executeInParallel(tasks);

    // Separate successful and failed results
    const successful = results.filter(r => r.status === 'success').map(r => r.data);
    const failed = results.filter(r => r.status === 'failed');

    res.json({
      images: successful,
      failed: failed.length > 0 ? failed.map(r => r.error) : undefined,
      unknownEntities: unknownEntities.length > 0 ? unknownEntities : undefined
    });
  })
);

/**
 * POST /api/decks/:deckId/slides/:slideId/tweak
 * Tweak an existing image
 */
router.post(
  '/decks/:deckId/slides/:slideId/tweak',
  validate(tweakImageSchema),
  asyncHandler(async (req, res) => {
    const { deckId, slideId } = req.params;
    const { imageId, prompt, count } = req.body;

    // Get slide and find source image
    const slide = await fileSystem.getSlide(deckId, slideId);
    const sourceImage = slide.generatedImages.find(img => img.id === imageId);

    if (!sourceImage) {
      return res.status(404).json({ error: 'Source image not found' });
    }

    // Read source image file
    const sourceImagePath = fileSystem.getImagePath(deckId, slideId, sourceImage.filename);
    const fs = await import('fs/promises');
    const sourceImageBuffer = await fs.readFile(sourceImagePath);

    // Generate tweaked images in parallel
    const tasks = Array.from({ length: count }, () => async () => {
      let imageBuffer;

      if (sourceImage.service === 'google-imagen') {
        imageBuffer = await googleImagen.tweakImage(sourceImageBuffer, prompt, '16:9');
      } else if (sourceImage.service === 'openai-dalle') {
        imageBuffer = await openaiDalle.tweakImage(sourceImageBuffer, prompt);
      } else {
        throw new Error(`Unknown service: ${sourceImage.service}`);
      }

      // Process image
      const processedBuffer = await imageProcessor.processImage(imageBuffer);

      // Save to file system
      const imageMetadata = await fileSystem.addGeneratedImage(deckId, slideId, processedBuffer, {
        id: uuidv4(),
        service: sourceImage.service,
        prompt: prompt,
        sourceImageId: imageId
      });

      return imageMetadata;
    });

    const results = await executeInParallel(tasks);

    // Separate successful and failed results
    const successful = results.filter(r => r.status === 'success').map(r => r.data);
    const failed = results.filter(r => r.status === 'failed');

    res.json({
      images: successful,
      failed: failed.length > 0 ? failed.map(r => r.error) : undefined
    });
  })
);

/**
 * POST /api/decks/:deckId/generate-all
 * Generate images for all slides in deck
 */
router.post(
  '/decks/:deckId/generate-all',
  validate(generateImagesSchema),
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const { count, service } = req.body;

    const deck = await fileSystem.getDeck(deckId);
    const slides = await fileSystem.getSlides(deckId);

    if (slides.length === 0) {
      return res.status(400).json({ error: 'No slides in deck' });
    }

    // Create job
    const jobId = uuidv4();
    const job = {
      jobId,
      deckId,
      type: 'generate-all',
      status: 'running',
      createdAt: new Date().toISOString(),
      completedAt: null,
      config: { count, service },
      progress: {
        total: slides.length,
        completed: 0,
        failed: 0,
        pending: slides.length
      },
      results: []
    };

    jobs.set(jobId, job);

    // Start generation in background
    generateAllInBackground(jobId, deck, slides, count, service);

    res.json({ jobId });
  })
);

/**
 * POST /api/decks/:deckId/generate-missing
 * Generate images only for slides without images
 */
router.post(
  '/decks/:deckId/generate-missing',
  validate(generateImagesSchema),
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const { count, service } = req.body;

    const deck = await fileSystem.getDeck(deckId);
    const allSlides = await fileSystem.getSlides(deckId);

    // Filter slides without images
    const slidesWithoutImages = allSlides.filter(slide => slide.generatedImages.length === 0);

    if (slidesWithoutImages.length === 0) {
      return res.json({
        message: 'All slides already have images',
        total: allSlides.length
      });
    }

    // Create job
    const jobId = uuidv4();
    const job = {
      jobId,
      deckId,
      type: 'generate-missing',
      status: 'running',
      createdAt: new Date().toISOString(),
      completedAt: null,
      config: { count, service },
      progress: {
        total: slidesWithoutImages.length,
        completed: 0,
        failed: 0,
        pending: slidesWithoutImages.length
      },
      results: []
    };

    jobs.set(jobId, job);

    // Start generation in background
    generateAllInBackground(jobId, deck, slidesWithoutImages, count, service);

    res.json({ jobId });
  })
);

/**
 * GET /api/jobs/:jobId
 * Get job status
 */
router.get('/jobs/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or expired' });
  }

  res.json(job);
}));

/**
 * Background function to generate images for multiple slides
 */
async function generateAllInBackground(jobId, deck, slides, count, service) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Generate for each slide sequentially (to respect rate limits)
    for (const slide of slides) {
      try {
        // Build prompt
        const { prompt } = buildFullPrompt(
          deck.visualStyle,
          slide.imageDescription,
          deck.entities
        );

        // Generate images
        const tasks = Array.from({ length: count }, () => async () => {
          let imageBuffer;

          if (service === 'google-imagen') {
            imageBuffer = await googleImagen.generateImage(prompt, '16:9');
          } else {
            imageBuffer = await openaiDalle.generateImage(prompt);
          }

          const processedBuffer = await imageProcessor.processImage(imageBuffer);

          return fileSystem.addGeneratedImage(deck.id, slide.id, processedBuffer, {
            id: uuidv4(),
            service,
            prompt
          });
        });

        const results = await executeInParallel(tasks);
        const imageCount = results.filter(r => r.status === 'success').length;

        job.results.push({
          slideId: slide.id,
          status: 'success',
          imageCount
        });

        job.progress.completed++;
        job.progress.pending--;
      } catch (error) {
        job.results.push({
          slideId: slide.id,
          status: 'failed',
          error: error.message
        });

        job.progress.failed++;
        job.progress.pending--;
      }
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
    job.completedAt = new Date().toISOString();
  }
}

export default router;
