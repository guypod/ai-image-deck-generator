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

export default router;
