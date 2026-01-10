import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { updateSettingsSchema, maskSettings } from '../models/Settings.js';
import * as fileSystem from '../services/fileSystem.js';

const router = express.Router();

/**
 * GET /api/settings
 * Get settings (with masked API keys)
 */
router.get('/', asyncHandler(async (req, res) => {
  const settings = await fileSystem.getSettings();
  const maskedSettings = maskSettings(settings);
  res.json(maskedSettings);
}));

/**
 * PUT /api/settings
 * Update settings
 */
router.put('/', validate(updateSettingsSchema), asyncHandler(async (req, res) => {
  const currentSettings = await fileSystem.getSettings();

  // Merge updates with current settings
  const updates = { ...currentSettings };

  if (req.body.defaultService !== undefined) {
    updates.defaultService = req.body.defaultService;
  }

  if (req.body.defaultVariantCount !== undefined) {
    updates.defaultVariantCount = req.body.defaultVariantCount;
  }

  const savedSettings = await fileSystem.saveSettings(updates);
  const maskedSettings = maskSettings(savedSettings);
  res.json(maskedSettings);
}));

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/auth/google', asyncHandler(async (req, res) => {
  // TODO: Implement OAuth flow
  // For now, return placeholder
  res.status(501).json({
    error: 'Google OAuth not yet implemented',
    message: 'This feature will be available soon'
  });
}));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/auth/google/callback', asyncHandler(async (req, res) => {
  // TODO: Implement OAuth callback
  res.status(501).json({
    error: 'Google OAuth not yet implemented'
  });
}));

/**
 * POST /api/auth/google/disconnect
 * Disconnect Google account
 */
router.post('/auth/google/disconnect', asyncHandler(async (req, res) => {
  const settings = await fileSystem.getSettings();

  if (settings.googleSlides) {
    settings.googleSlides.credentials = null;
  }

  await fileSystem.saveSettings(settings);
  res.json({ success: true });
}));

/**
 * GET /api/settings/global-entities
 * Get all global entities
 */
router.get('/global-entities', asyncHandler(async (req, res) => {
  const entities = await fileSystem.getGlobalEntities();
  res.json(entities);
}));

/**
 * POST /api/settings/global-entities
 * Add a new global entity with image
 */
router.post('/global-entities', asyncHandler(async (req, res) => {
  const { entityName, imageData } = req.body;

  if (!entityName || !imageData) {
    return res.status(400).json({
      error: 'entityName and imageData are required'
    });
  }

  // Validate entity name
  const entityNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!entityNameRegex.test(entityName)) {
    return res.status(400).json({
      error: 'Invalid entity name. Must be alphanumeric with hyphens, no spaces.'
    });
  }

  // Convert base64 image data to buffer
  const imageBuffer = Buffer.from(imageData, 'base64');

  const entities = await fileSystem.addGlobalEntity(entityName, imageBuffer, 'jpg');
  res.status(201).json(entities);
}));

/**
 * DELETE /api/settings/global-entities/:entityName
 * Remove a global entity
 */
router.delete('/global-entities/:entityName', asyncHandler(async (req, res) => {
  const { entityName } = req.params;
  const entities = await fileSystem.removeGlobalEntity(entityName);
  res.json(entities);
}));

/**
 * GET /api/settings/global-entities/:entityName/:imageFilename
 * Get global entity image file
 */
router.get('/global-entities/:entityName/:imageFilename', asyncHandler(async (req, res) => {
  const { imageFilename } = req.params;
  const imagePath = fileSystem.getGlobalEntityImagePath(imageFilename);

  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image file not found' });
    }
  });
}));

export default router;
