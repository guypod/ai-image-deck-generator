import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { createSlideSchema, updateSlideSchema, reorderSlidesSchema } from '../models/Slide.js';
import * as fileSystem from '../services/fileSystem.js';
import * as openaiDescriptions from '../services/openaiDescriptions.js';

const router = express.Router({ mergeParams: true });

/**
 * GET /api/decks/:deckId/slides
 * List all slides in deck
 */
router.get('/', asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const slides = await fileSystem.getSlides(deckId);
  res.json(slides);
}));

/**
 * GET /api/decks/:deckId/slides/:slideId
 * Get slide by ID
 */
router.get('/:slideId', asyncHandler(async (req, res) => {
  const { deckId, slideId } = req.params;
  const slide = await fileSystem.getSlide(deckId, slideId);
  res.json(slide);
}));

/**
 * POST /api/decks/:deckId/slides
 * Create new slide
 */
router.post('/', validate(createSlideSchema), asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const { speakerNotes, imageDescription } = req.body;
  const slide = await fileSystem.createSlide(deckId, speakerNotes, imageDescription);
  res.status(201).json(slide);
}));

/**
 * PUT /api/decks/:deckId/slides/:slideId
 * Update slide content
 */
router.put('/:slideId', validate(updateSlideSchema), asyncHandler(async (req, res) => {
  const { deckId, slideId } = req.params;
  const slide = await fileSystem.updateSlide(deckId, slideId, req.body);
  res.json(slide);
}));

/**
 * POST /api/decks/:deckId/slides/:slideId/generate-description
 * Generate image description using ChatGPT
 */
router.post('/:slideId/generate-description', asyncHandler(async (req, res) => {
  const { deckId, slideId } = req.params;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({
      error: 'OPENAI_API_KEY not configured in environment. Please add it to your .env file.'
    });
  }

  const deck = await fileSystem.getDeck(deckId);
  const slide = await fileSystem.getSlide(deckId, slideId);

  const description = await openaiDescriptions.generateImageDescription(
    slide.speakerNotes,
    deck.visualStyle,
    deck.entities,
    deck.themeImages || [],
    process.env.OPENAI_API_KEY
  );

  res.json({ description });
}));

/**
 * DELETE /api/decks/:deckId/slides/:slideId
 * Delete slide
 */
router.delete('/:slideId', asyncHandler(async (req, res) => {
  const { deckId, slideId } = req.params;
  await fileSystem.deleteSlide(deckId, slideId);
  res.json({ success: true });
}));

/**
 * POST /api/decks/:deckId/slides/reorder
 * Reorder slides
 */
router.post('/reorder', validate(reorderSlidesSchema), asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const { slideIds } = req.body;
  await fileSystem.reorderSlides(deckId, slideIds);
  res.json({ success: true });
}));

/**
 * GET /api/decks/:deckId/slides/:slideId/images/:imageId
 * Get image file
 */
router.get('/:slideId/images/:imageId', asyncHandler(async (req, res) => {
  const { deckId, slideId, imageId } = req.params;
  const slide = await fileSystem.getSlide(deckId, slideId);

  const image = slide.generatedImages.find(img => img.id === imageId);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const imagePath = fileSystem.getImagePath(deckId, slideId, image.filename);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image file not found' });
    }
  });
}));

/**
 * PUT /api/decks/:deckId/slides/:slideId/images/:imageId/pin
 * Pin an image
 */
router.put('/:slideId/images/:imageId/pin', asyncHandler(async (req, res) => {
  const { deckId, slideId, imageId } = req.params;
  const slide = await fileSystem.pinImage(deckId, slideId, imageId);
  res.json(slide);
}));

/**
 * DELETE /api/decks/:deckId/slides/:slideId/images/:imageId
 * Delete an image
 */
router.delete('/:slideId/images/:imageId', asyncHandler(async (req, res) => {
  const { deckId, slideId, imageId } = req.params;
  const slide = await fileSystem.deleteImage(deckId, slideId, imageId);
  res.json(slide);
}));

export default router;
