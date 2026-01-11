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

  if (req.body.googleSlidesTemplateUrl !== undefined) {
    if (!updates.googleSlides) {
      updates.googleSlides = { credentials: null, templateSlideUrl: null, templateSlideIndex: 1 };
    }
    updates.googleSlides.templateSlideUrl = req.body.googleSlidesTemplateUrl || null;
  }

  if (req.body.googleSlidesTemplateIndex !== undefined) {
    if (!updates.googleSlides) {
      updates.googleSlides = { credentials: null, templateSlideUrl: null, templateSlideIndex: 1 };
    }
    updates.googleSlides.templateSlideIndex = req.body.googleSlidesTemplateIndex || 1;
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
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('<h1>Error: No authorization code received</h1>');
  }

  try {
    const { google } = await import('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Return HTML page with the tokens
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google OAuth Success</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #4CAF50; }
          .token-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .token { word-break: break-all; font-family: monospace; font-size: 12px; }
          .copy-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 3px; }
          .copy-btn:hover { background: #45a049; }
          .instruction { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>✓ Authorization Successful!</h1>

        <div class="instruction">
          <strong>Next Steps:</strong>
          <ol>
            <li>Copy the refresh token below</li>
            <li>Add it to your <code>backend/.env</code> file as <code>GOOGLE_REFRESH_TOKEN</code></li>
            <li>Restart your backend server</li>
            <li>You can now export decks to Google Slides!</li>
          </ol>
        </div>

        <div class="token-box">
          <strong>GOOGLE_REFRESH_TOKEN:</strong><br>
          <div class="token" id="refreshToken">${tokens.refresh_token}</div>
          <button class="copy-btn" onclick="copyToken()">Copy to Clipboard</button>
        </div>

        <p><em>You can close this window now.</em></p>

        <script>
          function copyToken() {
            const token = document.getElementById('refreshToken').textContent;
            navigator.clipboard.writeText(token).then(() => {
              alert('Refresh token copied to clipboard!');
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`
      <h1>Error</h1>
      <p>${error.message}</p>
    `);
  }
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
