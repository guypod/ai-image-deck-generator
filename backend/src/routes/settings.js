import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import { updateSettingsSchema, testApiKeySchema, maskSettings } from '../models/Settings.js';
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

  if (req.body.apiKeys) {
    // Don't update keys if they're masked
    if (req.body.apiKeys.googleImagen && req.body.apiKeys.googleImagen !== '***masked***') {
      updates.apiKeys.googleImagen = req.body.apiKeys.googleImagen;
    }
    if (req.body.apiKeys.openaiDalle && req.body.apiKeys.openaiDalle !== '***masked***') {
      updates.apiKeys.openaiDalle = req.body.apiKeys.openaiDalle;
    }
    if (req.body.apiKeys.geminiNanoBanana && req.body.apiKeys.geminiNanoBanana !== '***masked***') {
      updates.apiKeys.geminiNanoBanana = req.body.apiKeys.geminiNanoBanana;
    }
  }

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
 * POST /api/settings/test-api-key
 * Test an API key
 */
router.post('/test-api-key', validate(testApiKeySchema), asyncHandler(async (req, res) => {
  const { service, apiKey } = req.body;

  try {
    let valid = false;
    let message = '';

    if (service === 'google-imagen') {
      // Test Google Imagen API
      // For now, just check if it's a non-empty string
      // Actual API test would require calling Vertex AI
      valid = apiKey && apiKey.length > 10;
      message = valid ? 'API key format looks valid' : 'Invalid API key format';
    } else if (service === 'openai-dalle') {
      // Test OpenAI API
      const { testOpenAIKey } = await import('../services/openaiDalle.js');
      const result = await testOpenAIKey(apiKey);
      valid = result.valid;
      message = result.message;
    } else if (service === 'gemini-flash' || service === 'gemini-pro') {
      // Test Gemini Nano Banana API
      const { testApiKey: testGeminiKey } = await import('../services/geminiNanoBanana.js');
      const result = await testGeminiKey(apiKey);
      valid = result.valid;
      message = result.message;
    }

    res.json({ valid, message });
  } catch (error) {
    res.status(400).json({
      valid: false,
      message: error.message || 'API key test failed'
    });
  }
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
