---
name: Slide Management
description: Create, read, update, and delete slides within decks
targets:
  - backend/src/routes/slides.js
  - backend/src/services/fileSystem.js
  - frontend/src/components/SlideList.jsx
  - frontend/src/components/SlideEditor.jsx
  - frontend/src/hooks/useSlides.js
---

# Slide Management

## Overview

Each deck contains multiple slides. Slides have speaker notes, image descriptions, and generated image variants. Users can create, edit, reorder, and delete slides.

## Functional Requirements

### Create Slide

**User Flow:**
1. User clicks "Add Slide" button in deck editor
2. System creates new slide at end of deck
3. User is navigated to slide editor
4. User enters speaker notes and image description

**API:**
- `POST /api/decks/:deckId/slides`
- Request body: `{ "speakerNotes": "", "imageDescription": "" }` (optional)
- Response: Full slide object with generated ID

**Requirements:**
- Generate slide ID (e.g., `slide-001`, `slide-002`)
- Create slide folder at `~/.ai-image-decks/{deckId}/{slideId}/`
- Create `slide.json` with initial data
- Set order based on current slide count
- Add slide ID to deck's slides array
- Update deck's updatedAt timestamp
- Initialize empty generatedImages array

[@test](../tests/backend/routes/slides.test.js#create-slide) - Create slide API endpoint
[@test](../tests/frontend/components/SlideList.test.js#create-slide) - Create slide UI flow

### List Slides in Deck

**User Flow:**
1. User opens deck editor
2. System displays all slides in order
3. Each slide shows thumbnail of pinned image (if any)

**API:**
- `GET /api/decks/:deckId/slides`
- Response: Array of slide objects in order

**Requirements:**
- Read all slide IDs from `deck.json`
- Load each `slide.json` file
- Return slides sorted by order field
- Include thumbnail URL for pinned image (if exists)

[@test](../tests/backend/routes/slides.test.js#list-slides) - List slides API endpoint
[@test](../tests/frontend/components/SlideList.test.js#display-slides) - Display slide list

### Get Slide Details

**User Flow:**
1. User clicks on slide in slide list
2. System loads slide details
3. System displays slide editor with content and images

**API:**
- `GET /api/decks/:deckId/slides/:slideId`
- Response: Full slide object including all generated images

**Requirements:**
- Read `slide.json` from slide folder
- Return 404 if slide doesn't exist
- Include all image metadata

[@test](../tests/backend/routes/slides.test.js#get-slide) - Get slide API endpoint

### Update Slide Content

**User Flow:**
1. User edits speaker notes or image description
2. System saves changes (on blur or auto-save)
3. System preserves existing generated images

**API:**
- `PUT /api/decks/:deckId/slides/:slideId`
- Request body: `{ "speakerNotes": "...", "imageDescription": "...", "overrideVisualStyle": "...", "noImages": false }`
- Response: Updated slide object

**Requirements:**
- Validate speakerNotes (0-5000 characters)
- Validate imageDescription (0-2000 characters)
- Validate overrideVisualStyle (0-1000 characters, nullable)
- Validate noImages (boolean)
- Preserve generatedImages array
- Atomic write to `slide.json`
- Update deck's updatedAt timestamp

**Visual Style Override:**
- When `overrideVisualStyle` is set, it completely replaces the deck's visual style for this slide
- The deck's visual style is NOT included when override is present
- Used in: image generation, description generation, bulk operations
- If override is null/empty, deck's visual style is used

[@test](../tests/backend/routes/slides.test.js#update-slide) - Update slide API endpoint
[@test](../tests/frontend/components/SlideEditor.test.js#update-content) - Update slide content UI

### Delete Slide

**User Flow:**
1. User clicks delete button on slide card
2. System shows confirmation dialog
3. User confirms deletion
4. System deletes slide and returns to deck editor

**API:**
- `DELETE /api/decks/:deckId/slides/:slideId`
- Response: `{ "success": true }`

**Requirements:**
- Delete entire slide folder recursively
- Remove all generated images
- Remove slide ID from deck's slides array
- Reorder remaining slides (update order field)
- Update deck's updatedAt timestamp
- Return 404 if slide doesn't exist

[@test](../tests/backend/routes/slides.test.js#delete-slide) - Delete slide API endpoint
[@test](../tests/frontend/components/SlideList.test.js#delete-slide) - Delete slide UI with confirmation

### Reorder Slides

**User Flow:**
1. User drags slide card to new position in slide list
2. System updates order immediately
3. System persists new order

**API:**
- `POST /api/decks/:deckId/slides/reorder`
- Request body: `{ "slideIds": ["slide-002", "slide-001", "slide-003"] }`
- Response: `{ "success": true }`

**Requirements:**
- Update order field in each slide's `slide.json`
- Update deck's slides array with new order
- Validate all slide IDs belong to deck
- Atomic operation (all or nothing)

[@test](../tests/backend/routes/slides.test.js#reorder-slides) - Reorder slides API endpoint
[@test](../tests/frontend/components/SlideList.test.js#reorder-slides) - Drag-and-drop reordering UI

## @Entity References

### Parsing @References

**User Flow:**
1. User types `@` in speaker notes or image description
2. System shows autocomplete with available entities
3. User selects entity or continues typing
4. System highlights @references in text
5. When generating images, system replaces @references with entity context

**Requirements:**
- Detect `@` followed by entity name in text
- Match entity names case-sensitively
- Allow multiple @references in same text
- Store original text with @references in slide.json
- Process @references when building prompts for AI

[@test](../tests/backend/utils/promptParser.test.js#parse-entity-references) - Parse @entity references
[@test](../tests/frontend/components/SlideEditor.test.js#entity-autocomplete) - @entity autocomplete UI

### Entity Autocomplete

**UI Behavior:**
- Trigger on `@` character
- Show dropdown with matching entities
- Filter as user types more characters
- Show entity thumbnail in dropdown
- Insert entity name on selection
- Close dropdown on Escape or click outside

[@test](../tests/frontend/components/SlideEditor.test.js#entity-autocomplete-keyboard) - Keyboard navigation

## Edge Cases

### Slide Without Images
- Slide is valid with no generated images
- Show placeholder in slide list
- Allow user to generate images

### No Pinned Image
- If no image is pinned, don't show thumbnail
- When first image is generated, automatically pin it
- If pinned image is deleted, auto-pin first remaining image (or none if last)

### Orphaned Slide Folders
- If slide folder exists but not in deck's slides array, ignore it
- Cleanup utility can remove orphaned folders (optional)

### Slide Reordering Race Conditions
- Use optimistic UI updates
- If reorder fails, revert to previous order
- Lock deck during reorder operation

## Validation

### Speaker Notes
- Optional (empty string allowed)
- 0-5000 characters
- UTF-8 text
- @entity references validated on save (warn if entity doesn't exist)

### Image Description
- Optional (empty string allowed)
- 0-2000 characters
- UTF-8 text
- @entity references validated on save

### Slide Order
- Must be 0-based sequential integers
- No gaps allowed
- Automatically fixed if corrupted

## UI Components

### SlideList Component
- Grid or list view of slide cards
- Each card shows:
  - Slide number (order + 1)
  - Thumbnail of pinned image
  - Preview of speaker notes (first 100 chars)
- Drag handles for reordering
- Add slide button
- Delete slide button (with confirmation)
- Click to open slide editor

### SlideEditor Component
- Back button to return to deck editor
- Slide number display
- Speaker notes textarea with @entity autocomplete
- Image description textarea with @entity autocomplete
- Generate images section (see image-generation.spec.md)
- ImageGallery component showing all variants
- Delete slide button

### Entity Autocomplete (shared component)
- Triggered by `@` character in textarea
- Dropdown positioned near cursor
- Filters entities as user types
- Shows entity thumbnail and name
- Keyboard navigation (arrow keys, Enter, Escape)
- Highlights @references in textarea (optional styling)

## Error Messages

- "Slide not found" - 404 when slide doesn't exist
- "Invalid speaker notes: maximum 5000 characters" - Too long
- "Invalid image description: maximum 2000 characters" - Too long
- "Entity '@EntityName' not found" - Referenced entity doesn't exist (warning)
- "Failed to create slide: [error]" - File system error
- "Cannot reorder: invalid slide IDs" - Slide IDs don't match deck

## Verification

1. Create multiple slides in a deck
2. Verify each slide has its own folder with `slide.json`
3. Update slide content with @entity references
4. Verify @references are preserved in storage
5. Reorder slides by dragging, verify order persists
6. Delete slide, verify folder is removed and order updates
7. Test @entity autocomplete with keyboard and mouse
8. Try invalid entity references, verify warnings
9. Create slide with very long text, verify validation
10. Test edge case: delete pinned image, verify auto-pin behavior
