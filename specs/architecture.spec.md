---
name: Architecture & Data Models
description: Overall system architecture, data models, and file system organization
targets:
  - backend/src/models/*.js
  - backend/src/services/fileSystem.js
---

# Architecture & Data Models

## Overview

The AI Image Deck Generator uses a client-server architecture with local file system storage. The backend provides REST APIs for the React frontend to manage decks, slides, and AI-generated images.

## Technology Stack

- **Frontend**: React 18 + Material-UI + Vite
- **Backend**: Node.js + Express
- **Storage**: Local file system in user home directory
- **AI Services**: Google Imagen, OpenAI DALL-E
- **Export**: Google Slides API

## File System Organization

All application data is stored in `~/.ai-image-decks/`:

```
~/.ai-image-decks/
├── settings.json                    # Global settings
├── deck-uuid-123/                   # One folder per deck
│   ├── deck.json                    # Deck metadata
│   ├── entities/                    # Entity reference images
│   │   ├── office.jpg
│   │   └── shaun1.jpg
│   ├── slide-001/                   # One folder per slide
│   │   ├── slide.json               # Slide metadata
│   │   ├── image-001.jpg            # Generated images
│   │   └── image-002.jpg
│   └── slide-002/
│       ├── slide.json
│       └── image-001.jpg
```

### Requirements

- Directory must be created on first run if it doesn't exist
- Each deck gets a UUID-based folder name
- Entity images stored separately from generated slide images
- All JSON files must be valid and atomically written (write to temp, then rename)
- Image files must be in JPEG format with 16:9 aspect ratio

## Data Models

### Deck Model

```json
{
  "id": "deck-uuid-123",
  "name": "My Presentation",
  "createdAt": "2025-01-08T10:00:00.000Z",
  "updatedAt": "2025-01-08T12:00:00.000Z",
  "visualStyle": "Professional corporate style with vibrant colors and modern design",
  "entities": {
    "The-Office": {
      "name": "The-Office",
      "images": ["office.jpg", "office-alt.jpg"]
    },
    "Shaun": {
      "name": "Shaun",
      "images": ["shaun1.jpg"]
    }
  },
  "slides": ["slide-001", "slide-002", "slide-003"]
}
```

**Field Requirements:**
- `id`: UUID v4, immutable after creation
- `name`: String, 1-200 characters, required
- `createdAt`: ISO 8601 timestamp with timezone, immutable
- `updatedAt`: ISO 8601 timestamp, updates on any change
- `visualStyle`: String, 0-1000 characters, describes visual style for all slides
- `entities`: Object mapping entity names to entity data
  - Entity names: alphanumeric + hyphens only, no spaces, 1-50 characters
  - Each entity has array of image filenames
- `slides`: Array of slide IDs in order

### Slide Model

```json
{
  "id": "slide-001",
  "order": 0,
  "speakerNotes": "Welcome to the presentation about @The-Office where @Shaun works",
  "imageDescription": "Wide shot of @The-Office with @Shaun at his desk working on computer",
  "generatedImages": [
    {
      "id": "img-uuid-1",
      "filename": "image-001.jpg",
      "createdAt": "2025-01-08T10:30:00.000Z",
      "service": "gemini-pro",
      "prompt": "Professional corporate style. Wide shot of office with person at desk working.",
      "sourceImageId": null,
      "isPinned": true
    },
    {
      "id": "img-uuid-2",
      "filename": "image-002.jpg",
      "createdAt": "2025-01-08T10:30:05.000Z",
      "service": "gemini-pro",
      "prompt": "Professional corporate style. Wide shot of office with person at desk working.",
      "sourceImageId": null,
      "isPinned": false
    },
    {
      "id": "img-uuid-3",
      "filename": "image-003.jpg",
      "createdAt": "2025-01-08T11:00:00.000Z",
      "service": "openai-gpt-image",
      "prompt": "Make the lighting warmer and more inviting",
      "sourceImageId": "img-uuid-1",
      "isPinned": false
    }
  ]
}
```

**Field Requirements:**
- `id`: Slide ID, unique within deck, immutable
- `order`: Integer, 0-based position in deck
- `speakerNotes`: String, 0-5000 characters, can contain @entity references
- `imageDescription`: String, 0-2000 characters, can contain @entity references
- `generatedImages`: Array of image metadata objects
  - `id`: UUID v4 for image, immutable
  - `filename`: Image filename (stored in slide folder)
  - `createdAt`: ISO 8601 timestamp, immutable
  - `service`: "openai-gpt-image", "gemini-flash", or "gemini-pro"
  - `prompt`: Full processed prompt used for generation
  - `sourceImageId`: UUID of source image if this is a tweak, null otherwise
  - `isPinned`: Boolean, exactly one image should be pinned per slide

### Settings Model

```json
{
  "defaultService": "gemini-pro",
  "defaultVariantCount": 2,
  "googleSlides": {
    "credentials": {
      "clientId": "google-client-id",
      "clientSecret": "google-client-secret",
      "refreshToken": "google-refresh-token"
    }
  }
}
```

**Environment Variables:**
API keys are now configured via environment variables in backend/.env:
- `GEMINI_API_KEY`: Google Gemini API key (for gemini-flash, gemini-pro)
- `OPENAI_API_KEY`: OpenAI API key (for openai-gpt-image)

**Field Requirements:**
- `defaultService`: "openai-gpt-image", "gemini-flash", or "gemini-pro"
- `defaultVariantCount`: Integer, 1-10
- `googleSlides.credentials`: OAuth credentials for Google Slides export

## Validation Rules

### Entity Name Validation
- Must match regex: `^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$`
- Length: 1-50 characters
- No spaces allowed
- Must start and end with alphanumeric character

### Image File Validation
- Format: JPEG only
- Aspect ratio: 16:9 (1.777:1 ± 0.01)
- Max file size: 10 MB
- Min dimensions: 1280x720
- Max dimensions: 3840x2160

### Prompt Validation
- After processing @entity references, total prompt length must be 1-2000 characters
- Must be valid UTF-8

## Error Handling

The system must handle:
- **File system errors**: Permission denied, disk full, path not found
- **Invalid JSON**: Corrupted configuration files
- **Missing files**: Referenced images that don't exist
- **Validation errors**: Invalid entity names, malformed data

All errors should be logged and return appropriate HTTP status codes:
- 400: Bad request (validation error)
- 404: Resource not found
- 500: Internal server error (file system error)

## Testing

[@test](../tests/backend/models/models.test.js) - Validate all data models with Joi schemas
[@test](../tests/backend/services/fileSystem.test.js) - Test file system CRUD operations

## Verification

1. Create a deck with entities
2. Verify `deck.json` is valid JSON matching schema
3. Add entity images, verify they're stored in `entities/` folder
4. Create slides, verify `slide.json` files match schema
5. Generate images, verify proper 16:9 aspect ratio
6. Verify atomic writes (no corrupted files on crash)
7. Test with invalid data (malformed JSON, invalid entity names)
