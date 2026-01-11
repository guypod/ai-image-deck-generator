import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { createDeckSchema, updateDeckSchema, addEntitySchema, entityNameSchema, createDeckFromTextSchema } from '../models/Deck.js';
import { exportDeckSchema } from '../models/Settings.js';
import * as fileSystem from '../services/fileSystem.js';
import { parseTextToSlides } from '../utils/textParser.js';
import * as openaiDescriptions from '../services/openaiDescriptions.js';
import { executeInParallel } from '../utils/asyncPool.js';
import { exportToGoogleSlides } from '../services/googleSlidesExport.js';
import { exportToPowerPointBuffer } from '../services/powerpointExport.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

/**
 * GET /api/decks
 * List all decks
 * Query params: includeTest=true to include test decks
 */
router.get('/', asyncHandler(async (req, res) => {
  const includeTest = req.query.includeTest === 'true';
  const decks = await fileSystem.getAllDecks(includeTest);
  res.json(decks);
}));

/**
 * GET /api/decks/:deckId
 * Get deck by ID
 */
router.get('/:deckId', asyncHandler(async (req, res) => {
  const deck = await fileSystem.getDeck(req.params.deckId);
  res.json(deck);
}));

/**
 * POST /api/decks
 * Create new deck
 */
router.post('/', validate(createDeckSchema), asyncHandler(async (req, res) => {
  const { name, visualStyle, isTest } = req.body;
  const deck = await fileSystem.createDeck(name, visualStyle, isTest);
  res.status(201).json(deck);
}));

/**
 * POST /api/decks/from-text
 * Create new deck from text block
 * Each line/bullet becomes a slide
 * Lines with bullets (* or -) = content slides (with images)
 * Lines without bullets = scene starts (no images, reset context)
 * ~name is converted to @name entity references
 */
router.post('/from-text', validate(createDeckFromTextSchema), asyncHandler(async (req, res) => {
  const { name, text, visualStyle, isTest } = req.body;

  // Create the deck
  const deck = await fileSystem.createDeck(name, visualStyle || '', isTest || false);

  // Parse text into slide objects (with text, noImages, and sceneStart flags)
  const slideObjects = parseTextToSlides(text);

  // Create slides with appropriate noImages and sceneStart settings
  const createdSlides = [];
  for (const slideObj of slideObjects) {
    const slide = await fileSystem.createSlide(deck.id, slideObj.text, '', slideObj.noImages, slideObj.sceneStart);
    createdSlides.push(slide);
  }

  // Get updated deck with slides
  const updatedDeck = await fileSystem.getDeck(deck.id);

  res.status(201).json({
    deck: updatedDeck,
    slidesCreated: createdSlides.length
  });
}));

/**
 * PUT /api/decks/:deckId
 * Update deck metadata
 */
router.put('/:deckId', validate(updateDeckSchema), asyncHandler(async (req, res) => {
  const deck = await fileSystem.updateDeck(req.params.deckId, req.body);
  res.json(deck);
}));

/**
 * DELETE /api/decks/:deckId
 * Delete deck
 */
router.delete('/:deckId', asyncHandler(async (req, res) => {
  await fileSystem.deleteDeck(req.params.deckId);
  res.json({ success: true });
}));

/**
 * POST /api/decks/:deckId/entities
 * Add entity to deck
 */
router.post(
  '/:deckId/entities',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;
    const { entityName } = req.body;

    // Validate entity name
    const { error } = addEntitySchema.validate({ entityName });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const imageExtension = req.file.mimetype.split('/')[1] || 'jpg';
    const deck = await fileSystem.addEntity(
      deckId,
      entityName,
      req.file.buffer,
      imageExtension
    );

    res.status(201).json(deck);
  })
);

/**
 * DELETE /api/decks/:deckId/entities/:entityName
 * Remove entity from deck
 */
router.delete('/:deckId/entities/:entityName', asyncHandler(async (req, res) => {
  const { deckId, entityName } = req.params;

  // Validate entity name
  const { error } = entityNameSchema.validate(entityName);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const deck = await fileSystem.removeEntity(deckId, entityName);
  res.json(deck);
}));

/**
 * GET /api/decks/:deckId/entities/:entityName/:filename
 * Get entity image file
 */
router.get('/:deckId/entities/:entityName/:filename', asyncHandler(async (req, res) => {
  const { deckId, filename } = req.params;
  const imagePath = fileSystem.getEntityImagePath(deckId, filename);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
}));

/**
 * POST /api/decks/:deckId/theme-images
 * Upload theme image
 */
router.post(
  '/:deckId/theme-images',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { deckId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const imageExtension = req.file.mimetype.split('/')[1] || 'jpg';
    const result = await fileSystem.addThemeImage(
      deckId,
      req.file.buffer,
      imageExtension
    );

    res.status(201).json(result.deck);
  })
);

/**
 * DELETE /api/decks/:deckId/theme-images/:filename
 * Remove theme image
 */
router.delete('/:deckId/theme-images/:filename', asyncHandler(async (req, res) => {
  const { deckId, filename } = req.params;

  const deck = await fileSystem.removeThemeImage(deckId, filename);
  res.json(deck);
}));

/**
 * GET /api/decks/:deckId/theme-images/:filename
 * Get theme image file
 */
router.get('/:deckId/theme-images/:filename', asyncHandler(async (req, res) => {
  const { deckId, filename } = req.params;
  const imagePath = fileSystem.getThemeImagePath(deckId, filename);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
}));

/**
 * POST /api/decks/:deckId/regenerate-descriptions
 * Regenerate image descriptions for all unlocked slides
 */
router.post('/:deckId/regenerate-descriptions', asyncHandler(async (req, res) => {
  const { deckId } = req.params;

  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({
      error: 'OPENAI_API_KEY not configured in environment. Please add it to your .env file.'
    });
  }

  const deck = await fileSystem.getDeck(deckId);
  const slides = await fileSystem.getSlides(deckId);

  // Filter out locked slides
  const unlockedSlides = slides.filter(slide => !slide.descriptionLocked);

  if (unlockedSlides.length === 0) {
    return res.json({
      message: 'All slides have locked descriptions',
      regenerated: 0,
      skipped: slides.length
    });
  }

  // Get merged entities
  const mergedEntities = await fileSystem.getMergedEntities(deckId);

  // Create tasks for parallel execution
  const tasks = unlockedSlides.map(slide => async () => {
    // Get effective visual style (considers slide override, scene style, deck style)
    const visualStyle = await fileSystem.getEffectiveVisualStyle(deckId, slide.id);

    // Get speaker notes from previous slides for context
    // Skip if slide has noContext flag set
    let previousSlideNotes = [];
    if (!slide.noContext) {
      // Only include slides after the most recent scene start
      const previousSlides = slides
        .filter(s => s.order < slide.order)
        .sort((a, b) => a.order - b.order);

      // Find the most recent scene start before this slide
      let contextStartIndex = 0;
      for (let i = previousSlides.length - 1; i >= 0; i--) {
        if (previousSlides[i].sceneStart) {
          contextStartIndex = i + 1; // Start from the slide after the scene start
          break;
        }
      }

      // Only include slides from after the most recent scene start
      previousSlideNotes = previousSlides
        .slice(contextStartIndex)
        .map(s => s.speakerNotes);
    }

    const description = await openaiDescriptions.generateImageDescription(
      slide.speakerNotes,
      visualStyle,
      mergedEntities,
      deck.themeImages || [],
      process.env.OPENAI_API_KEY,
      previousSlideNotes
    );

    // Update the slide
    await fileSystem.updateSlide(deckId, slide.id, { imageDescription: description });

    return {
      slideId: slide.id,
      description
    };
  });

  // Execute in parallel with concurrency limit of 5
  const results = await executeInParallel(tasks, 5);

  // Count successful and failed
  const regenerated = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  // Format results
  const formattedResults = results.map((result, index) => {
    if (result.status === 'success') {
      return {
        slideId: result.data.slideId,
        status: 'success',
        description: result.data.description
      };
    } else {
      return {
        slideId: unlockedSlides[index].id,
        status: 'failed',
        error: result.error
      };
    }
  });

  res.json({
    message: `Regenerated ${regenerated} description(s)`,
    regenerated,
    failed,
    skipped: slides.length - unlockedSlides.length,
    results: formattedResults
  });
}));

/**
 * GET /api/decks/:deckId/export-state
 * Get current export state (for resume capability)
 */
router.get('/:deckId/export-state', asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const state = await fileSystem.getExportState(deckId);

  if (!state) {
    return res.json({ hasExportInProgress: false });
  }

  res.json({
    hasExportInProgress: state.phase !== 'complete',
    state
  });
}));

/**
 * DELETE /api/decks/:deckId/export-state
 * Clear export state (cancel/reset export)
 */
router.delete('/:deckId/export-state', asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  await fileSystem.clearExportState(deckId);
  res.json({ success: true });
}));

/**
 * POST /api/decks/:deckId/export
 * Export deck to Google Slides
 * Body options:
 *   - title: Presentation title (optional, defaults to deck name)
 *   - fromSlideIndex: Start from this slide index (0-based, optional)
 *   - resume: Continue from existing export state (optional)
 */
router.post('/:deckId/export', validate(exportDeckSchema), asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const { title, fromSlideIndex = 0, resume = false } = req.body;

  // Get settings
  const settings = await fileSystem.getSettings();

  if (!settings.googleSlides?.templateSlideUrl) {
    return res.status(400).json({
      error: 'Template slide URL not configured. Please add it in settings.'
    });
  }

  // Check if credentials are configured
  const credentials = settings.googleSlides?.credentials || null;

  // Get deck and slides
  const deck = await fileSystem.getDeck(deckId);
  const slides = await fileSystem.getSlides(deckId);

  // Use deck name as title if not provided
  const exportTitle = title || deck.name;

  // Get storage directory
  const storageDir = fileSystem.getStorageDir();

  // Check for existing export state if resuming
  let existingState = null;
  if (resume) {
    existingState = await fileSystem.getExportState(deckId);
    if (!existingState) {
      return res.status(400).json({
        error: 'No export in progress to resume'
      });
    }
    if (existingState.phase === 'complete') {
      return res.status(400).json({
        error: 'Previous export already completed. Start a new export instead.'
      });
    }
    console.log(`Resuming export for deck ${deckId} from slide ${existingState.lastProcessedSlide + 1}`);
  } else {
    // Clear any existing state when starting fresh
    await fileSystem.clearExportState(deckId);
  }

  // Export to Google Slides with state tracking
  const result = await exportToGoogleSlides(
    deck,
    slides,
    deckId,
    storageDir,
    credentials,
    settings.googleSlides.templateSlideUrl,
    exportTitle,
    settings.googleSlides.templateSlideIndex || 1,
    {
      fromSlideIndex: resume ? (existingState?.fromSlideIndex || 0) : fromSlideIndex,
      existingState: resume ? existingState : null,
      saveState: async (state) => {
        await fileSystem.saveExportState(deckId, state);
      }
    }
  );

  // Clear export state on successful completion
  await fileSystem.clearExportState(deckId);

  res.json({
    success: true,
    presentationId: result.presentationId,
    url: result.url,
    exportedSlideCount: result.exportedSlideCount
  });
}));

/**
 * POST /api/decks/:deckId/export-pptx
 * Export deck to PowerPoint file (downloads as .pptx)
 * Body options:
 *   - title: Presentation title (optional, defaults to deck name)
 *   - fromSlideIndex: Start from this slide index (0-based, optional)
 */
router.post('/:deckId/export-pptx', validate(exportDeckSchema), asyncHandler(async (req, res) => {
  const { deckId } = req.params;
  const { title, fromSlideIndex = 0 } = req.body;

  // Get settings for template configuration
  const settings = await fileSystem.getSettings();

  // Get deck and slides
  const deck = await fileSystem.getDeck(deckId);
  const slides = await fileSystem.getSlides(deckId);

  // Use deck name as title if not provided
  const exportTitle = title || deck.name;

  // Get storage directory
  const storageDir = fileSystem.getStorageDir();

  console.log(`Starting PowerPoint export for deck ${deckId}...`);

  // Get local PowerPoint template path if configured
  const localTemplatePath = await fileSystem.getPowerPointTemplatePath();

  // Export to PowerPoint buffer (prefer local template, fall back to Google Slides template)
  const result = await exportToPowerPointBuffer(
    deck,
    slides,
    deckId,
    storageDir,
    exportTitle,
    {
      fromSlideIndex,
      localTemplatePath,
      templateSlideIndex: settings.powerPoint?.templateSlideIndex || settings.googleSlides?.templateSlideIndex || 1,
      // Fall back to Google template if no local template
      templateUrl: settings.googleSlides?.templateSlideUrl || null,
      credentials: settings.googleSlides?.credentials || null
    }
  );

  // Set headers for file download
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.setHeader('Content-Length', result.buffer.length);

  // Send the buffer
  res.send(result.buffer);
}));

export default router;
