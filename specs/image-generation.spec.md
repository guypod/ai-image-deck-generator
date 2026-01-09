---
name: Image Generation
description: Generate and manage AI-generated images for slides
targets:
  - backend/src/routes/images.js
  - backend/src/services/googleImagen.js
  - backend/src/services/openaiDalle.js
  - backend/src/services/imageProcessor.js
  - backend/src/utils/promptParser.js
  - frontend/src/components/ImageGallery.jsx
  - frontend/src/hooks/useImages.js
---

# Image Generation

## Overview

Users can generate AI images for slides using Google Imagen or OpenAI DALL-E. They can generate multiple variants, tweak existing images, and manage the generated images.

## Functional Requirements

### Generate Image Variants

**User Flow:**
1. User is in slide editor with speaker notes and image description entered
2. User selects number of variants (1-10, default 2)
3. User selects AI service (Google Imagen or OpenAI DALL-E)
4. User clicks "Generate" button
5. System generates variants in parallel
6. System displays all variants in image gallery
7. First generated image is automatically pinned

**API:**
- `POST /api/decks/:deckId/slides/:slideId/generate`
- Request body: `{ "count": 2, "service": "gemini-pro" }`
- Response: `{ "images": [{...}, {...}] }`

**Requirements:**
- Validate count (1-10)
- Validate service ("openai-gpt-image", "gemini-flash", or "gemini-pro")
- Parse @entity references from imageDescription
- Combine visualStyle + imageDescription into full prompt
- Generate specified number of variants in parallel
- Enforce 16:9 aspect ratio (1920x1080 or equivalent)
- Save all images to slide folder with unique filenames
- Add metadata to slide's generatedImages array
- Auto-pin first image if no pinned image exists
- Update slide.json atomically
- Show progress/loading state in UI

[@test](../tests/backend/routes/images.test.js#generate-images) - Generate images API endpoint
[@test](../tests/backend/services/openaiGptImage.test.js#text-to-image) - OpenAI GPT Image text-to-image
[@test](../tests/backend/services/geminiNanoBanana.test.js#text-to-image) - Gemini text-to-image
[@test](../tests/backend/utils/promptParser.test.js#build-full-prompt) - Build full prompt
[@test](../tests/frontend/components/SlideEditor.test.js#generate-images) - Generate images UI

### Prompt Processing

**Prompt Construction:**
1. Load deck's visualStyle
2. Load slide's imageDescription
3. Parse @entity references in imageDescription
4. Replace @Entity-Name with "Entity Name" (remove hyphens)
5. Combine: `{visualStyle}. {processedDescription}. 16:9 aspect ratio, presentation quality.`
6. Validate final prompt length (1-2000 characters)

**Entity Reference Handling:**
- `@The-Office` → "The Office"
- `@Shaun` → "Shaun"
- Multiple references: `@Shaun at @The-Office` → "Shaun at The Office"
- Unknown entity: log warning, keep original text

**Requirements:**
- Case-sensitive matching
- Only replace exact entity names
- Don't replace partial matches (e.g., @Sha shouldn't match @Shaun)
- Handle multiple references in same text
- Visual style can be empty (use description only)

[@test](../tests/backend/utils/promptParser.test.js#parse-entity-references) - Parse entity references
[@test](../tests/backend/utils/promptParser.test.js#multiple-references) - Multiple @entity refs
[@test](../tests/backend/utils/promptParser.test.js#unknown-entity) - Unknown entity handling

### Tweak Image (Image-to-Image)

**User Flow:**
1. User views generated image in gallery
2. User clicks "Tweak" button on image
3. System shows dialog with text input for modification
4. User enters description of desired change (e.g., "warmer lighting")
5. User selects number of variants (1-10, default 2)
6. User clicks "Tweak" button in dialog
7. System generates new variants using original image + prompt
8. System adds new variants to gallery (doesn't replace)

**API:**
- `POST /api/decks/:deckId/slides/:slideId/tweak`
- Request body: `{ "imageId": "img-uuid-1", "prompt": "warmer lighting", "count": 2 }`
- Response: `{ "images": [{...}, {...}] }`

**Requirements:**
- Validate imageId exists in slide
- Validate prompt (1-500 characters)
- Validate count (1-10)
- Use image-to-image generation (not text-to-image)
- Pass original image file + modification prompt to AI service
- Generate specified number of variants in parallel
- Save all new images to slide folder
- Set sourceImageId to original image's ID
- Add variants to generatedImages array (append, don't replace)
- Update slide.json atomically

[@test](../tests/backend/routes/images.test.js#tweak-image) - Tweak image API endpoint
[@test](../tests/backend/services/googleImagen.test.js#image-to-image) - Google Imagen image-to-image
[@test](../tests/backend/services/openaiDalle.test.js#image-to-image) - OpenAI DALL-E image-to-image
[@test](../tests/frontend/components/ImageGallery.test.js#tweak-image) - Tweak image UI

### Pin Image

**User Flow:**
1. User views multiple image variants in gallery
2. User clicks "Pin" button on preferred image
3. System unpins previously pinned image
4. System pins selected image
5. System updates UI to show pin badge

**API:**
- `PUT /api/decks/:deckId/slides/:slideId/images/:imageId/pin`
- Response: Updated slide object

**Requirements:**
- Validate imageId exists in slide
- Set isPinned=false on all other images
- Set isPinned=true on selected image
- Exactly one image should be pinned per slide (if any exist)
- Update slide.json atomically
- Update UI optimistically

[@test](../tests/backend/routes/images.test.js#pin-image) - Pin image API endpoint
[@test](../tests/frontend/components/ImageGallery.test.js#pin-image) - Pin image UI

### Delete Image Variant

**User Flow:**
1. User views image in gallery
2. User clicks delete button on image
3. System shows confirmation dialog
4. User confirms deletion
5. System deletes image file and metadata
6. If deleted image was pinned, auto-pin another image

**API:**
- `DELETE /api/decks/:deckId/slides/:slideId/images/:imageId`
- Response: `{ "success": true }`

**Requirements:**
- Validate imageId exists in slide
- Delete image file from slide folder
- Remove metadata from generatedImages array
- If deleted image was pinned:
  - If other images exist, auto-pin first one
  - If no other images, leave none pinned
- Update slide.json atomically
- Show confirmation dialog (frontend)

[@test](../tests/backend/routes/images.test.js#delete-image) - Delete image API endpoint
[@test](../tests/frontend/components/ImageGallery.test.js#delete-image) - Delete image UI

### Get Image File

**User Flow:**
1. UI requests image URL for display
2. Backend streams image file
3. UI displays image

**API:**
- `GET /api/decks/:deckId/slides/:slideId/images/:imageId`
- Response: Image file (JPEG) with appropriate headers

**Requirements:**
- Validate imageId exists in slide
- Stream image file from disk
- Set proper Content-Type header (image/jpeg)
- Set Cache-Control headers for browser caching
- Return 404 if image file not found

[@test](../tests/backend/routes/images.test.js#get-image-file) - Get image file endpoint

## AI Service Integration

### Google Imagen

**Text-to-Image:**
- Use Vertex AI API with model `imagegeneration@006`
- Request 16:9 aspect ratio
- Set appropriate safety filters
- Allow person generation
- Handle rate limiting (retry with exponential backoff)

**Image-to-Image:**
- Use same model with referenceImage parameter
- Pass base64-encoded source image
- Use editMode: "product-image" for modifications
- Maintain aspect ratio from source

**Error Handling:**
- API key invalid: return 401 to frontend
- Rate limit exceeded: retry up to 3 times with backoff
- Content policy violation: return 400 with error message
- Network error: retry up to 3 times

[@test](../tests/backend/services/googleImagen.test.js#text-to-image) - Text-to-image generation
[@test](../tests/backend/services/googleImagen.test.js#image-to-image) - Image-to-image generation
[@test](../tests/backend/services/googleImagen.test.js#error-handling) - Error handling

### OpenAI DALL-E

**Text-to-Image:**
- Use DALL-E 3 with size 1792x1024 (closest to 16:9)
- Set quality to "hd"
- Use URL response format
- Download and save image locally

**Image-to-Image:**
- Use DALL-E 2 edit API (DALL-E 3 doesn't support edits)
- Note: DALL-E 2 limited to 1024x1024
- Post-process to crop/resize to 16:9

**Error Handling:**
- API key invalid: return 401
- Content policy violation: return 400 with error
- Rate limit: retry with exponential backoff
- Network error: retry up to 3 times

[@test](../tests/backend/services/openaiDalle.test.js#text-to-image-dalle3) - DALL-E 3 generation
[@test](../tests/backend/services/openaiDalle.test.js#image-to-image-dalle2) - DALL-E 2 editing
[@test](../tests/backend/services/openaiDalle.test.js#aspect-ratio-conversion) - Aspect ratio handling

### Image Processing

**Aspect Ratio Enforcement:**
- Target: 1920x1080 (16:9)
- Tolerance: ±1% (1.76:1 to 1.79:1 acceptable)
- If outside tolerance:
  - Calculate crop box to center-crop to 16:9
  - Use Sharp library for cropping

**Format Conversion:**
- Convert PNG to JPEG if needed
- Set JPEG quality to 90
- Optimize file size (use Sharp compression)
- Strip metadata (privacy)

**Validation:**
- Verify file is valid image
- Check dimensions (min 1280x720, max 3840x2160)
- Check file size (max 10 MB)
- Reject if invalid

[@test](../tests/backend/services/imageProcessor.test.js#enforce-aspect-ratio) - Aspect ratio enforcement
[@test](../tests/backend/services/imageProcessor.test.js#format-conversion) - Format conversion
[@test](../tests/backend/services/imageProcessor.test.js#validation) - Image validation

## Parallel Generation

**Requirements:**
- Generate multiple variants concurrently
- Limit concurrency to 5-10 requests (avoid rate limits)
- Use p-limit library for concurrency control
- Handle partial failures gracefully:
  - If some succeed and some fail, save successful ones
  - Return array with success/error status for each
- Show progress in UI (e.g., "Generated 3 of 5 images")

[@test](../tests/backend/utils/asyncPool.test.js#parallel-execution) - Parallel execution
[@test](../tests/backend/utils/asyncPool.test.js#partial-failures) - Partial failure handling

## Edge Cases

### No Image Description
- If imageDescription is empty, use only visualStyle
- Append generic: "presentation slide image, 16:9 aspect ratio"
- Don't generate if both visualStyle and imageDescription are empty (show error)

### API Key Not Configured
- Check settings before attempting generation
- Return 400: "API key not configured for [service]"
- Frontend shows link to settings page

### All Generations Fail
- If all variants fail to generate, return 500 with errors
- Don't create any image metadata in slide.json
- Show error message with details

### Regenerating Images
- Generating new images adds to existing variants
- Never replaces existing images
- User can delete unwanted variants manually

### Tweaking Deleted Image
- If source image was deleted, tweak fails with 404
- Frontend disables tweak button for deleted source images

## Validation

### Generation Request
- count: integer, 1-10, required
- service: "openai-gpt-image" | "gemini-flash" | "gemini-pro", required
- API key must be configured in environment (GEMINI_API_KEY or OPENAI_API_KEY)

### Tweak Request
- imageId: valid UUID, must exist in slide
- prompt: string, 1-500 characters, required
- count: integer, 1-10, required

### Image Metadata
- id: UUID v4
- filename: string, matches pattern `image-\d{3}\.jpg`
- createdAt: ISO 8601 timestamp
- service: "openai-gpt-image" | "gemini-flash" | "gemini-pro"
- prompt: string, 1-2000 characters
- sourceImageId: null or valid UUID
- isPinned: boolean

## UI Components

### ImageGallery Component
- Grid layout (2-3 columns on desktop, 1 on mobile)
- Each image card shows:
  - Image preview
  - Pin badge if pinned
  - Tweak button
  - Delete button
  - Service used (icon or text)
  - Timestamp
- Click image to view full size
- Hover shows full prompt in tooltip

### TweakDialog Component
- Modal dialog
- Text input for modification prompt
- Variant count selector (1-10)
- Preview of source image
- Generate button
- Cancel button

### GenerateSection Component (in SlideEditor)
- Variant count selector (1-10, default from settings)
- Service selector (OpenAI GPT Image, Gemini Flash, Gemini Pro)
- Generate button (prominent)
- Show loading spinner during generation
- Show progress: "Generating 3 of 5 images..."
- Show errors if generation fails

## Error Messages

- "API key not configured for [service]" - No API key
- "Image generation failed: [error]" - Service error
- "Invalid prompt: maximum 2000 characters" - Prompt too long
- "Image not found" - Invalid image ID
- "Cannot tweak image: source image not found" - Source deleted
- "Content policy violation: [details]" - AI service rejected prompt
- "Rate limit exceeded. Please try again in a moment." - Too many requests

## Verification

1. Configure API keys in settings
2. Create slide with visual style and image description containing @entity references
3. Generate 2 variants, verify both created in parallel
4. Verify images are 16:9 aspect ratio
5. Verify @entity references replaced in prompts
6. Pin an image, verify only one pinned
7. Tweak pinned image with "warmer lighting", verify new variants added
8. Delete an image variant, verify file and metadata removed
9. Generate with both Google Imagen and OpenAI DALL-E
10. Test error cases: invalid API key, empty description, content violation
11. Generate 10 variants, verify concurrency limiting works
12. Test partial failures (mock some API calls to fail)
