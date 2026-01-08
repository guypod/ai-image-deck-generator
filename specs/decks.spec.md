---
name: Deck Management
description: Create, read, update, and delete slide decks with entities
targets:
  - backend/src/routes/decks.js
  - backend/src/services/fileSystem.js
  - frontend/src/components/DeckList.jsx
  - frontend/src/components/DeckEditor.jsx
  - frontend/src/hooks/useDecks.js
---

# Deck Management

## Overview

Users can create multiple slide decks, each with its own visual style and named entities. Decks contain slides and serve as the top-level organizational unit.

## Functional Requirements

### Create Deck

**User Flow:**
1. User clicks "New Deck" button
2. System prompts for deck name
3. System creates deck with default values
4. User is navigated to deck editor

**API:**
- `POST /api/decks`
- Request body: `{ "name": "My Presentation" }`
- Response: `{ "id": "deck-uuid", "name": "My Presentation", ... }`

**Requirements:**
- Generate UUID v4 for deck ID
- Create deck folder at `~/.ai-image-decks/{deckId}/`
- Create `deck.json` with initial data
- Create empty `entities/` folder
- Set timestamps (createdAt, updatedAt)
- Initialize empty entities object and slides array

[@test](../tests/backend/routes/decks.test.js#create-deck) - Create deck API endpoint
[@test](../tests/frontend/components/DeckList.test.js#create-deck) - Create deck UI flow

### List Decks

**User Flow:**
1. User opens application
2. System displays all existing decks as cards
3. Each card shows deck name and slide count

**API:**
- `GET /api/decks`
- Response: `[{ "id": "...", "name": "...", "slides": [...] }, ...]`

**Requirements:**
- Scan `~/.ai-image-decks/` for deck folders
- Read each `deck.json` file
- Return array sorted by updatedAt (newest first)
- Handle missing or corrupted files gracefully

[@test](../tests/backend/routes/decks.test.js#list-decks) - List decks API endpoint
[@test](../tests/frontend/components/DeckList.test.js#display-decks) - Display deck list

### Get Deck Details

**User Flow:**
1. User clicks on a deck card
2. System loads deck details
3. System displays deck editor with metadata and entities

**API:**
- `GET /api/decks/:deckId`
- Response: Full deck object with all metadata

**Requirements:**
- Read `deck.json` from deck folder
- Return 404 if deck doesn't exist
- Include all entities and slide IDs

[@test](../tests/backend/routes/decks.test.js#get-deck) - Get deck API endpoint

### Update Deck Metadata

**User Flow:**
1. User edits deck name or visual style in deck editor
2. System saves changes automatically (or on blur)
3. System updates `updatedAt` timestamp

**API:**
- `PUT /api/decks/:deckId`
- Request body: `{ "name": "...", "visualStyle": "..." }`
- Response: Updated deck object

**Requirements:**
- Validate name (1-200 characters)
- Validate visualStyle (0-1000 characters)
- Update `updatedAt` timestamp
- Atomic write to `deck.json`

[@test](../tests/backend/routes/decks.test.js#update-deck) - Update deck API endpoint
[@test](../tests/frontend/components/DeckEditor.test.js#update-metadata) - Update deck metadata UI

### Delete Deck

**User Flow:**
1. User clicks delete button on deck card
2. System shows confirmation dialog
3. User confirms deletion
4. System deletes deck and all associated data

**API:**
- `DELETE /api/decks/:deckId`
- Response: `{ "success": true }`

**Requirements:**
- Delete entire deck folder recursively
- Remove all slides, images, and entities
- Show confirmation dialog before deletion (frontend)
- Return 404 if deck doesn't exist

[@test](../tests/backend/routes/decks.test.js#delete-deck) - Delete deck API endpoint
[@test](../tests/frontend/components/DeckList.test.js#delete-deck) - Delete deck UI with confirmation

### Manage Entities

**User Flow:**
1. User is in deck editor
2. User adds a new entity with name and image(s)
3. System validates entity name
4. System uploads and stores entity images
5. Entity is available for @references in slides

**API:**
- `PUT /api/decks/:deckId/entities`
- Request: Multipart form data with entity name and image files
- Response: Updated deck object with new entity

**Add Entity Requirements:**
- Validate entity name (alphanumeric + hyphens, no spaces)
- Check for duplicate entity names
- Upload images to `entities/` folder
- Update `deck.json` with entity data
- Update `updatedAt` timestamp

**Remove Entity Requirements:**
- Delete entity images from `entities/` folder
- Remove entity from `deck.json`
- Warn if entity is referenced in any slide (frontend)
- Update `updatedAt` timestamp

[@test](../tests/backend/routes/decks.test.js#add-entity) - Add entity API endpoint
[@test](../tests/backend/routes/decks.test.js#remove-entity) - Remove entity API endpoint
[@test](../tests/frontend/components/DeckEditor.test.js#manage-entities) - Manage entities UI

## Edge Cases

### Duplicate Deck Names
- System allows duplicate names (IDs are unique)
- Consider showing warning to user (optional)

### Corrupted deck.json
- If JSON is invalid, show error in UI
- Provide option to delete corrupted deck
- Log error for debugging

### Entity Name Conflicts
- Prevent adding entity with same name as existing
- Show error message: "Entity name already exists"

### Referenced Entities in Slides
- When deleting entity, check if it's used in slides
- Show warning: "This entity is referenced in X slides"
- Allow deletion (user responsibility to update slides)

## Validation

### Deck Name
- Required
- 1-200 characters
- Any printable characters allowed

### Visual Style
- Optional (empty string allowed)
- 0-1000 characters
- Plain text (no markdown)

### Entity Name
- Required
- 1-50 characters
- Pattern: `^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$`
- Must be unique within deck

### Entity Images
- JPEG format only
- Max 10 MB per file
- Valid image file (check header)

## UI Components

### DeckList Component
- Grid of deck cards (responsive)
- Each card shows: deck name, slide count, last updated
- "New Deck" button (prominent)
- Delete button on each card (with confirmation)
- Click card to open deck editor

### DeckEditor Component
- Deck name input field
- Visual style textarea (multiline)
- EntityManager component for entities
- SlideList component showing all slides
- BulkActions component for bulk operations
- Export to Google Slides button

### EntityManager Component
- List of entities with preview thumbnails
- Add entity button
- Entity name input (validates on blur)
- Image upload (drag & drop or file picker)
- Remove entity button (with confirmation if referenced)

## Error Messages

- "Deck not found" - 404 when deck doesn't exist
- "Invalid deck name" - Name too short/long
- "Invalid entity name: must contain only letters, numbers, and hyphens" - Invalid entity name format
- "Entity name already exists" - Duplicate entity name
- "Failed to create deck: [error]" - File system error
- "This entity is referenced in X slides. Delete anyway?" - Warning before deletion

## Verification

1. Create multiple decks with different names
2. Verify each deck has its own folder with `deck.json`
3. Update deck metadata, verify changes persist
4. Add entities with images, verify stored in `entities/` folder
5. Try invalid entity names (with spaces, special chars), verify rejection
6. Delete deck, verify folder is removed completely
7. Test with corrupted `deck.json`, verify graceful error handling
8. List decks, verify sorted by most recently updated
