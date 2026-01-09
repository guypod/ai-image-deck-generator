---
name: Settings Management
description: Manage API keys, default preferences, and Google account connection
targets:
  - backend/src/routes/settings.js
  - backend/src/services/fileSystem.js
  - frontend/src/components/Settings.jsx
  - frontend/src/hooks/useSettings.js
---

# Settings Management

## Overview

Users can configure default preferences and connect their Google account for Slides export. Settings are stored globally (not per deck) in `~/.ai-image-decks/settings.json`.

**API Keys:** AI service API keys are configured via environment variables in `backend/.env`:
- `GEMINI_API_KEY` - For gemini-flash and gemini-pro services
- `OPENAI_API_KEY` - For openai-gpt-image service

## Functional Requirements

### Get Settings

**User Flow:**
1. User navigates to Settings page
2. System loads current settings
3. System displays defaults and Google account status
4. System shows informational message about environment variable configuration

**API:**
- `GET /api/settings`
- Response:
  ```json
  {
    "defaultService": "gemini-pro",
    "defaultVariantCount": 2,
    "googleSlides": {
      "connected": true,
      "email": "user@example.com"
    }
  }
  ```

**Requirements:**
- Load settings from `~/.ai-image-decks/settings.json`
- If file doesn't exist, return defaults
- Don't send API keys or refresh tokens to frontend
- Include Google account connection status
- API keys are read from process.env in backend only

[@test](../tests/backend/routes/settings.test.js#get-settings) - Get settings endpoint
[@test](../tests/frontend/components/Settings.test.js#load-settings) - Load settings UI

### Update Settings

**User Flow:**
1. User is on Settings page
2. User changes default service or variant count
3. User clicks "Save" button
4. System validates and saves settings
5. System shows success message

**API:**
- `PUT /api/settings`
- Request body:
  ```json
  {
    "defaultService": "gemini-pro",
    "defaultVariantCount": 3
  }
  ```
- Response: Updated settings

**Requirements:**
- Validate all fields
- Atomic write to settings.json
- Create `~/.ai-image-decks/` directory if needed
- Set file permissions to 0600 (owner read/write only) for security
- Return validation errors if invalid
- Default service must be one of: "openai-gpt-image", "gemini-flash", "gemini-pro"

[@test](../tests/backend/routes/settings.test.js#update-settings) - Update settings endpoint
[@test](../tests/frontend/components/Settings.test.js#update-settings) - Update settings UI

### Configure API Keys

**User Flow:**
1. User stops the application
2. User edits `backend/.env` file
3. User adds or updates API keys:
   - `GEMINI_API_KEY=your-key-here`
   - `OPENAI_API_KEY=your-key-here`
4. User restarts the application
5. Application reads keys from environment on startup

**Requirements:**
- API keys are read from process.env only
- Keys are never stored in settings.json
- Keys are never sent to frontend
- Frontend displays informational message about .env configuration
- Show links to get API keys:
  - Gemini: https://ai.google.dev
  - OpenAI: https://platform.openai.com

### Connect Google Account

**User Flow:**
1. User is on Settings page
2. User clicks "Connect Google Account" button
3. System opens OAuth consent screen in popup/new tab
4. User authorizes app
5. System receives OAuth callback
6. System exchanges code for tokens
7. System stores refresh token in settings
8. System shows success message with email

**API:**
- `GET /api/auth/google` - Initiate OAuth flow
  - Redirects to Google consent screen
- `GET /api/auth/google/callback` - OAuth callback
  - Query params: `code`, `state`
  - Exchanges code for tokens
  - Stores refresh token in settings
  - Redirects to settings page with success message

**Requirements:**
- Generate secure state parameter (CSRF protection)
- Store state in session (or short-lived JWT)
- Validate state in callback
- Exchange authorization code for tokens
- Store refresh token in settings.json
- Get user email from Google API
- Return user to settings page

[@test](../tests/backend/routes/settings.test.js#oauth-initiate) - Initiate OAuth flow
[@test](../tests/backend/routes/settings.test.js#oauth-callback) - OAuth callback
[@test](../tests/frontend/components/Settings.test.js#connect-google) - Connect Google account UI

### Disconnect Google Account

**User Flow:**
1. User is on Settings page with Google account connected
2. User clicks "Disconnect" button
3. System shows confirmation dialog
4. User confirms
5. System removes OAuth credentials from settings
6. System shows success message

**API:**
- `POST /api/auth/google/disconnect`
- Response: `{ "success": true }`

**Requirements:**
- Remove googleSlides.credentials from settings
- Optionally revoke token with Google (good practice)
- Show confirmation dialog (frontend)
- Update UI to show disconnected state

[@test](../tests/backend/routes/settings.test.js#disconnect-google) - Disconnect Google account
[@test](../tests/frontend/components/Settings.test.js#disconnect-google) - Disconnect UI

## Data Model

### Settings Structure

```json
{
  "apiKeys": {
    "googleImagen": "actual-key-value-here",
    "openaiDalle": "actual-key-value-here"
  },
  "defaultService": "google-imagen",
  "defaultVariantCount": 2,
  "googleSlides": {
    "credentials": {
      "clientId": "google-client-id",
      "clientSecret": "google-client-secret",
      "refreshToken": "google-refresh-token",
      "email": "user@example.com",
      "connectedAt": "2025-01-08T10:00:00.000Z"
    }
  }
}
```

### Default Values

If settings.json doesn't exist:
```json
{
  "defaultService": "gemini-pro",
  "defaultVariantCount": 2,
  "googleSlides": {
    "credentials": null
  }
}
```

## Validation

### Default Service
- Must be: "openai-gpt-image", "gemini-flash", or "gemini-pro"
- Required

### Default Variant Count
- Type: integer
- Min: 1
- Max: 10
- Required

### Google OAuth Credentials
- clientId: string, required if credentials provided
- clientSecret: string, required if credentials provided
- refreshToken: string, required if credentials provided
- email: string, email format, required
- connectedAt: ISO 8601 timestamp

## Security Considerations

### API Key Storage
- API keys are stored in backend/.env file only
- File permissions: 0600 (owner read/write only) recommended
- Never log full API keys
- Never send keys to frontend
- Keys are read from process.env on backend startup

### OAuth Tokens
- Store refresh token securely in settings.json
- Never expose refresh token to frontend
- Use HTTPS for OAuth in production
- Implement CSRF protection with state parameter
- Validate redirect URI matches registered URI

### File Permissions
- Settings file: 0600 (owner only)
- Settings directory: 0700 (owner only)
- Check and fix permissions on startup

## Edge Cases

### First Run
- No settings.json exists
- Create with defaults
- Show welcome message
- Prompt to configure API keys

### Corrupted settings.json
- If JSON is invalid, log error
- Create backup of corrupted file
- Reset to defaults
- Show error message to user

### Partial Settings
- If some fields missing, fill with defaults
- Migrate old settings format if schema changes

### Multiple Instances
- If multiple app instances run, last write wins
- Consider file locking (advanced)
- Or warn user about multiple instances

### API Key Format Changes
- AI services may change key formats
- Don't validate format, only test with API
- Allow any reasonable string

## UI Components

### Settings Component
- Tabbed or sectioned layout:
  - **AI Services**
    - Google Imagen API key input
    - Test button
    - OpenAI DALL-E API key input
    - Test button
  - **Defaults**
    - Default service radio buttons
    - Default variant count slider (1-10)
  - **Google Account**
    - Connection status
    - Connect/Disconnect button
    - Email display if connected

- Save button (disabled until changes made)
- Reset to defaults button
- Success/error toast notifications

### API Key Input Component
- Password-style input (masked)
- Show/hide toggle button
- Test button (loads while testing)
- Status indicator (✅ valid, ❌ invalid, ⏳ not tested)
- Link to service documentation for getting key

### Google Account Status Component
- Show status badge:
  - ✅ Connected: user@example.com
  - ❌ Not connected
- Connect button (opens OAuth flow)
- Disconnect button with confirmation
- Last connected timestamp
- Link to Google account permissions page

## Error Messages

- "Failed to load settings: [error]" - File system error
- "Invalid API key format" - Validation error
- "API key test failed: [error]" - Test failed
- "Failed to save settings: [error]" - Save error
- "Google authentication failed: [error]" - OAuth error
- "Default service must be google-imagen or openai-dalle" - Validation
- "Variant count must be between 1 and 10" - Validation
- "Please configure API key for [service] before using it" - Missing key

## Help Text

### Google Imagen
- "Get your API key from Google Cloud Console"
- Link: https://console.cloud.google.com/
- Instructions: "Enable Vertex AI API and create API key"

### OpenAI DALL-E
- "Get your API key from OpenAI Platform"
- Link: https://platform.openai.com/api-keys
- Instructions: "Create new secret key with image permissions"

### Google Slides
- "Connect your Google account to export presentations"
- "Requires Google Slides and Google Drive permissions"
- "You can disconnect at any time"

## Verification

1. First run: verify settings.json created with defaults
2. Enter Google Imagen API key, click Test, verify success
3. Enter invalid key, verify error message
4. Save settings, verify persisted to disk
5. Reload settings page, verify settings loaded correctly
6. Update default variant count, verify saved
7. Connect Google account, verify OAuth flow
8. Verify email and connection status displayed
9. Disconnect Google account, verify credentials removed
10. Test file permissions (should be 0600)
11. Corrupt settings.json manually, verify graceful handling
12. Test with missing settings file, verify defaults used
13. Check that API keys are masked in GET response
14. Test concurrent updates (race condition)

## Migration Strategy

If settings schema changes in future:

```javascript
function migrateSettings(settings) {
  // V1 to V2: add new field
  if (!settings.version || settings.version === 1) {
    settings.newField = defaultValue;
    settings.version = 2;
  }
  // V2 to V3: rename field
  if (settings.version === 2) {
    settings.renamedField = settings.oldField;
    delete settings.oldField;
    settings.version = 3;
  }
  return settings;
}
```

[@test](../tests/backend/services/settingsMigration.test.js) - Settings migration
