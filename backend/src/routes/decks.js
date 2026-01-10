import express from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { createDeckSchema, updateDeckSchema, addEntitySchema, entityNameSchema } from '../models/Deck.js';
import * as fileSystem from '../services/fileSystem.js';

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
 */
router.get('/', asyncHandler(async (req, res) => {
  const decks = await fileSystem.getAllDecks();
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
  const { name, visualStyle, storageType } = req.body;
  const deck = await fileSystem.createDeck(name, visualStyle, storageType);
  res.status(201).json(deck);
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

export default router;
