---
name: Google Slides Export
description: Export slide decks to Google Slides presentations
targets:
  - backend/src/routes/export.js
  - backend/src/services/googleSlides.js
  - frontend/src/components/ExportDialog.jsx
---

# Google Slides Export

## Overview

Users can export their slide decks to Google Slides presentations. Each slide's pinned image becomes a slide in the presentation, with speaker notes included.

## Functional Requirements

### Export to Google Slides

**User Flow:**
1. User is in deck editor
2. User clicks "Export to Google Slides" button
3. System shows export dialog
4. User enters presentation title (optional, defaults to deck name)
5. User clicks "Export" button
6. System authenticates with Google (if needed)
7. System creates presentation
8. System adds slides with images and speaker notes
9. System shows success message with link to presentation
10. User can click link to open presentation in Google Slides

**API:**
- `POST /api/decks/:deckId/export`
- Request body: `{ "title": "My Presentation" }`
- Response:
  ```json
  {
    "presentationId": "google-presentation-id",
    "url": "https://docs.google.com/presentation/d/presentation-id/edit",
    "slideCount": 10
  }
  ```

**Requirements:**
- Validate deck exists and has at least 1 slide
- Check Google OAuth credentials are configured
- For each slide in order:
  - Use pinned image (skip if no pinned image)
  - Create slide in presentation
  - Add image to slide (16:9 layout)
  - Add speaker notes to slide
- Create presentation with given title (or deck name)
- Return presentation URL
- Show progress during export

[@test](../tests/backend/routes/export.test.js#export-to-slides) - Export API endpoint
[@test](../tests/backend/services/googleSlides.test.js#create-presentation) - Create presentation
[@test](../tests/frontend/components/ExportDialog.test.js#export-flow) - Export UI flow

## Google Slides API Integration

### Authentication (OAuth 2.0)

**Initial Setup:**
1. User clicks "Connect Google Account" in settings
2. System opens OAuth consent screen
3. User authorizes app with Google
4. System receives authorization code
5. System exchanges code for access token + refresh token
6. System stores refresh token in settings.json
7. Access token used for API calls (expires in 1 hour)
8. Refresh token used to get new access tokens automatically

**OAuth Flow:**
- Use OAuth 2.0 with PKCE for security
- Scopes required:
  - `https://www.googleapis.com/auth/presentations` - Create/edit presentations
  - `https://www.googleapis.com/auth/drive.file` - Upload images temporarily
- Redirect URI: `http://localhost:3000/api/auth/google/callback` (dev) or production URL

[@test](../tests/backend/services/googleSlides.test.js#oauth-flow) - OAuth authentication

### Create Presentation

**API Calls:**
1. Create empty presentation:
   ```javascript
   POST https://slides.googleapis.com/v1/presentations
   {
     "title": "My Presentation"
   }
   ```

2. For each slide, batch update with:
   - Create blank slide (if needed)
   - Upload image to Google Drive temporarily
   - Add image to slide
   - Add speaker notes

**Requirements:**
- Use batch update API for efficiency
- Each slide uses BLANK layout
- Images sized to fit slide (16:9 aspect ratio)
- Speaker notes added to notes page
- Clean up temporary Drive files after export

[@test](../tests/backend/services/googleSlides.test.js#batch-update) - Batch slide creation

### Image Upload Strategy

**Temporary Drive Upload:**
1. Upload image to Google Drive
2. Make file publicly readable (temporarily)
3. Get shareable URL
4. Add image to presentation using URL
5. Delete file from Drive after presentation created

**Alternative (Direct Upload):**
- Use `createImage` with inline image data
- Requires base64 encoding
- Simpler but larger requests

**Requirements:**
- Images must be accessible via URL for Slides API
- Clean up all temporary files
- Handle upload failures gracefully

[@test](../tests/backend/services/googleSlides.test.js#image-upload) - Image upload to Drive

## Edge Cases

### Slides Without Pinned Images
- Skip slides that have no pinned image
- Or create text-only slide with speaker notes (user choice)
- Show warning: "X slides skipped (no pinned image)"

### No Google Account Connected
- Check OAuth credentials before export
- If not configured, show error and link to settings
- Error: "Please connect your Google account in Settings"

### OAuth Token Expired
- Access tokens expire after 1 hour
- Automatically refresh using refresh token
- If refresh fails, prompt user to re-authenticate

### Large Presentations
- Google Slides supports up to 100 slides per presentation
- If deck has more, show warning or split into multiple presentations
- Limit enforced in validation

### Network Failures
- Retry failed API calls up to 3 times
- If export fails mid-way:
  - Delete partial presentation (or leave for user to delete)
  - Show error with details
  - User can retry

### Duplicate Presentation Titles
- Google Slides allows duplicate titles
- Each export creates new presentation
- Consider adding timestamp to title (optional)

## Validation

### Export Request
- deckId: must exist
- title: string, 1-200 characters, optional
- Deck must have at least 1 slide
- At least 1 slide must have pinned image

### OAuth Credentials
- clientId: required
- clientSecret: required
- refreshToken: required
- Must be valid (test with Google API)

### Presentation Limits
- Max 100 slides per presentation
- Max 50 MB total image size
- Each image max 2 MB

## UI Components

### ExportDialog Component
- Modal dialog
- Presentation title input (defaults to deck name)
- Preview: "Export X slides with images, Y without"
- Warning if some slides missing images
- Export button (primary)
- Cancel button
- Loading spinner during export

### ExportProgress Component
- Shows during export
- Progress bar (optional)
- Status text: "Creating presentation..."
- "Uploading images..."
- "Adding speaker notes..."

### ExportSuccess Component
- Success message: "Presentation created successfully!"
- Link to open presentation in new tab
- Button to copy link
- Close button

### GoogleAccountStatus Component (in Settings)
- Show connection status:
  - ✅ Connected: email@example.com
  - ❌ Not connected
- "Connect Google Account" button
- "Disconnect" button
- Last used timestamp

## Error Messages

- "Please connect your Google account in Settings" - No OAuth
- "Google authentication expired. Please reconnect." - Token expired
- "Deck must have at least one slide with a pinned image" - Nothing to export
- "Export failed: [error details]" - API error
- "Presentation too large: maximum 100 slides" - Too many slides
- "X slides skipped (no pinned image)" - Warning

## API Rate Limits

**Google Slides API:**
- Quota: 500 requests per 100 seconds per user
- 3000 requests per 100 seconds per project
- Burst: 100 requests per second

**Handling:**
- Batch updates to minimize requests
- Exponential backoff on rate limit errors
- Show progress to user (don't hang)

**Optimization:**
- Combine operations in batch update (max 500 per request)
- Use batch create for slides + images + notes

## Security

### OAuth Tokens
- Store refresh token securely in settings.json
- Never expose tokens to frontend
- Use HTTPS for OAuth redirect (production)
- Implement CSRF protection (state parameter)

### API Keys
- Don't commit OAuth client secrets to git
- Use environment variables for secrets
- Rotate secrets if compromised

### Permissions
- Request minimum necessary scopes
- User can revoke access via Google Account settings
- Provide instructions for revoking access

## Verification

1. Configure Google OAuth in Google Cloud Console
2. Connect Google account in settings
3. Verify refresh token stored in settings.json
4. Create deck with 5 slides, each with pinned image
5. Export to Google Slides
6. Verify presentation created with 5 slides
7. Verify each slide has correct image (16:9)
8. Verify speaker notes included
9. Test export with custom title
10. Test edge case: some slides without pinned images
11. Disconnect and reconnect Google account
12. Test OAuth token refresh (wait 1 hour or mock expiration)
13. Test with network failures (mock API errors)
14. Verify temporary Drive files cleaned up
15. Test rate limiting (export very large deck or rapid exports)

## Google Cloud Console Setup

**Required Configuration:**
1. Create project in Google Cloud Console
2. Enable APIs:
   - Google Slides API
   - Google Drive API
3. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
4. Copy client ID and client secret
5. Add to backend environment variables:
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - `GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback`

**OAuth Consent Screen:**
- App name: "AI Image Deck Generator"
- User support email
- Developer contact
- Scopes: Google Slides API, Google Drive API
- Test users (for development)

[@doc] Setup instructions in README or docs folder
