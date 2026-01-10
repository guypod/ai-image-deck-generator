---
name: Slide Deck UI Redesign
description: Presentation-style interface with slide thumbnails panel and editor view
targets:
  - frontend/src/components/DeckEditor.jsx
  - frontend/src/components/SlideDeckView.jsx
  - frontend/src/components/SlideThumbnail.jsx
  - frontend/src/components/SlideEditor.jsx
  - frontend/src/hooks/useSlides.js
---

# Slide Deck UI Redesign

## Overview

Redesign the slide editing interface to match traditional presentation software (PowerPoint, Keynote, Google Slides) with a left sidebar showing slide thumbnails and a main area showing the selected slide's editor.

## User Requirements

Based on stakeholder interview:
- **Thumbnail Display**: Generated image preview (with placeholder if no images)
- **Reordering**: Drag and drop functionality
- **Main Area**: Full slide editor with all controls and generated images
- **Initial State**: Auto-select first slide when opening deck

## Functional Requirements

### Layout Structure

**Two-Column Layout:**
```
┌─────────────────────────────────────────┐
│  Header (Deck name, Back button)       │
├──────────┬──────────────────────────────┤
│          │                              │
│  Left    │  Main Editor Area            │
│  Panel   │                              │
│  (250px) │  - Speaker Notes             │
│          │  - Image Description         │
│  Slides  │  - Generate Controls         │
│  List    │  - Generated Images Gallery  │
│          │                              │
│  [+]     │                              │
└──────────┴──────────────────────────────┘
```

**Requirements:**
- Left panel: Fixed 250-300px width
- Main area: Flexible, takes remaining space
- Responsive: On mobile (<768px), stack vertically or show only one panel at a time
- Header: Deck name, back button to deck list, deck settings icon

### Left Panel: Slide Thumbnails

**Display per Slide:**
- Thumbnail preview (16:9 aspect ratio, ~200px wide)
  - If pinned/first generated image exists: show it
  - If no images: show placeholder with slide number
- Slide number badge (e.g., "1", "2", "3")
- Hover state: Show delete button (trash icon)
- Selected state: Highlighted border/background
- Drag handle: Visual indicator that slide can be dragged

**Thumbnail Image Rules:**
- Show pinned image if exists
- Otherwise show first image in generatedImages array
- If no images, show gray placeholder with large slide number
- Image should be clickable to select slide

**Add Slide Button:**
- Location: Bottom of slide list (always visible)
- Label: "+ Add Slide" or "+ New Slide"
- Action: Creates new slide and auto-selects it

[@test](../tests/frontend/components/SlideThumbnail.test.js#render-with-image) - Render thumbnail with image
[@test](../tests/frontend/components/SlideThumbnail.test.js#render-placeholder) - Render thumbnail without image
[@test](../tests/frontend/components/SlideThumbnail.test.js#selected-state) - Selected state styling

### Slide Selection

**User Flow:**
1. User clicks on slide thumbnail in left panel
2. System loads slide details
3. System displays slide editor in main area
4. Thumbnail shows selected state (highlighted)

**Requirements:**
- Only one slide can be selected at a time
- Selected slide ID stored in component state
- URL updates to include slide ID (e.g., `/decks/:deckId?slide=slide-002`)
- Browser back/forward buttons work with slide selection
- Deep linking: Opening URL with slide ID auto-selects that slide

**Initial Selection:**
- When deck opens: Auto-select first slide (order=0)
- If no slides exist: Show empty state with "Create First Slide" button

[@test](../tests/frontend/components/SlideDeckView.test.js#auto-select-first) - Auto-select first slide on load
[@test](../tests/frontend/components/SlideDeckView.test.js#update-url-on-select) - Update URL when slide selected
[@test](../tests/frontend/components/SlideDeckView.test.js#deep-link-slide) - Deep link to specific slide

### Drag and Drop Reordering

**User Flow:**
1. User clicks and holds on slide thumbnail
2. System shows drag preview (ghosted thumbnail)
3. User drags to new position
4. System shows drop indicator (line between slides)
5. User releases mouse
6. System updates slide order
7. System persists new order to backend

**Visual Feedback:**
- Cursor changes to "grabbing" during drag
- Dragged item shows semi-transparent ghost
- Drop target shows blue line indicator
- Other slides shift to make space

**Requirements:**
- Use HTML5 drag and drop API or library (react-beautiful-dnd recommended)
- Optimistic UI update (reorder immediately, rollback if API fails)
- Disable drag during API call to prevent race conditions
- Keyboard accessibility: Tab + Arrow keys to reorder

[@test](../tests/frontend/components/SlideDeckView.test.js#drag-drop-reorder) - Drag and drop reordering
[@test](../tests/frontend/components/SlideDeckView.test.js#reorder-rollback) - Rollback on API failure
[@test](../tests/frontend/components/SlideDeckView.test.js#keyboard-reorder) - Keyboard reordering

### Delete Slide from Thumbnail

**User Flow:**
1. User hovers over slide thumbnail
2. System shows delete button (trash icon)
3. User clicks delete button
4. System shows confirmation dialog
5. User confirms deletion
6. System deletes slide
7. System auto-selects adjacent slide (next or previous)

**Requirements:**
- Delete button only visible on hover (or always on touch devices)
- Confirmation dialog: "Delete this slide? This cannot be undone."
- After deletion:
  - If deleted slide was selected, select next slide (or previous if last)
  - If deleted slide was only slide, show empty state
- API call to DELETE /api/decks/:deckId/slides/:slideId
- Remove from local state immediately (optimistic UI)

[@test](../tests/frontend/components/SlideThumbnail.test.js#show-delete-on-hover) - Show delete button on hover
[@test](../tests/frontend/components/SlideDeckView.test.js#delete-and-select-next) - Delete and auto-select next slide
[@test](../tests/frontend/components/SlideDeckView.test.js#delete-confirmation) - Confirmation dialog

### Add Slide from Panel

**User Flow:**
1. User clicks "+ Add Slide" button at bottom of left panel
2. System creates new slide at end of deck
3. System auto-selects new slide
4. System scrolls to new slide in left panel
5. User sees empty slide editor ready for input

**Requirements:**
- Button always visible at bottom of slide list
- New slide created with empty speaker notes and image description
- New slide has next sequential order number
- API call to POST /api/decks/:deckId/slides
- Optimistic UI: Show new slide immediately
- Focus on speaker notes textarea after creation

[@test](../tests/frontend/components/SlideDeckView.test.js#add-slide-from-panel) - Add slide from panel
[@test](../tests/frontend/components/SlideDeckView.test.js#auto-select-new-slide) - Auto-select newly created slide

### Main Area: Slide Editor

**Content:**
- All existing SlideEditor functionality preserved:
  - Speaker notes textarea
  - Image description textarea
  - Generate description button (ChatGPT)
  - Override visual style field
  - No images checkbox
  - Service selector (Gemini Flash/Pro, OpenAI)
  - Generate images button
  - Generated images gallery with pin/delete
  - Save changes indicator

**Header:**
- Slide number: "Slide 1", "Slide 2", etc.
- Delete slide button (with confirmation)
- Optional: Duplicate slide button (future)

**Changes from Current:**
- Remove "Back to Deck" button (no longer needed, thumbnails are always visible)
- Add slide number/title at top
- Keep all editing controls and image generation features

[@test](../tests/frontend/components/SlideEditor.test.js#render-in-deck-view) - Render in deck view layout

## UI Components

### New Components

**SlideDeckView:**
- Container for entire slide deck interface
- Manages selected slide state
- Handles slide list and editor communication
- URL state synchronization

**SlideThumbnail:**
- Individual slide thumbnail component
- Props: slide, isSelected, onSelect, onDelete, onDragStart, onDragEnd
- Renders thumbnail image or placeholder
- Shows slide number badge
- Hover state with delete button

**SlidePanel:**
- Left sidebar container
- Scrollable list of SlideThumbnail components
- Drag and drop zone
- Add slide button at bottom

### Modified Components

**SlideEditor:**
- Remove navigation header (back button)
- Add slide number display
- Same editing functionality
- Receives slide via props instead of URL params

**DeckEditor:**
- Remove slide list from deck editor
- Deck editor now only for deck-level settings (name, visual style, entities, theme images)
- Link to open SlideDeckView for editing slides

## Routing Changes

**New Route:**
- `/decks/:deckId/edit` - Opens SlideDeckView
- Query param: `?slide=slide-002` - Selects specific slide
- Old route `/decks/:deckId/slides/:slideId` - Redirects to new route

**Navigation:**
- From deck list: Click deck name → Opens `/decks/:deckId/edit`
- From deck settings: "Edit Slides" button → Opens `/decks/:deckId/edit`
- Deep linking: Share URL with slide param to open specific slide

## Empty States

### No Slides in Deck
- Show large "+ Create First Slide" button
- Subtext: "Add slides to your presentation"
- Right side shows helpful tips or empty canvas

### No Generated Images
- Slide thumbnail shows placeholder with slide number
- Main editor shows "No images yet" message
- Generate images button is primary CTA

## Error Handling

### Failed Slide Reorder
- Show error toast: "Failed to reorder slides"
- Rollback to previous order in UI
- User can retry by dragging again

### Failed Slide Deletion
- Show error alert: "Failed to delete slide: [error]"
- Slide remains in list
- User can retry deletion

### Failed Slide Creation
- Show error toast: "Failed to create slide"
- Remove optimistic new slide from UI
- User can retry with add button

### Load Error
- If deck fails to load: Show error page with retry button
- If slides fail to load: Show error in left panel with retry button

## Accessibility

### Keyboard Navigation
- Tab: Navigate between thumbnails and controls
- Arrow Up/Down: Navigate between slides in panel
- Enter: Select slide
- Delete key: Delete selected slide (with confirmation)
- Ctrl+N: New slide
- Ctrl+S: Save current slide (if unsaved changes)

### Screen Reader
- Announce slide number and position (e.g., "Slide 2 of 5")
- Announce when slide is selected: "Slide 2 selected"
- Announce when slide is reordered: "Slide moved from position 3 to position 1"
- Announce deletion: "Slide 2 deleted. Slide 3 now selected."

### Focus Management
- When slide selected, focus stays on thumbnail (don't auto-focus editor)
- When new slide created, focus on speaker notes textarea
- When slide deleted, focus on newly selected slide thumbnail

[@test](../tests/frontend/components/SlideDeckView.test.js#keyboard-navigation) - Keyboard navigation
[@test](../tests/frontend/components/SlideDeckView.test.js#screen-reader-announcements) - Screen reader support

## Performance Considerations

### Thumbnail Images
- Lazy load thumbnails (only load visible + 2 above/below)
- Cache thumbnail URLs
- Use low-res previews for thumbnails (don't load full images)
- Consider generating thumbnail versions on backend (future optimization)

### Drag Performance
- Use transform instead of position for drag animation
- Throttle drag events
- Disable transitions during drag

### Large Decks
- Virtualize slide list if >50 slides (use react-window)
- Paginate or lazy load slides
- Show "Loading..." state while fetching slides

## Validation

Same validation as slides.spec.md:
- Speaker notes: 0-5000 characters
- Image description: 0-2000 characters
- @entity references validated on save

## Verification Steps

1. Open deck, verify first slide auto-selected
2. Click different thumbnails, verify selection updates and editor shows correct slide
3. Add new slide from panel, verify it appears at end and is auto-selected
4. Drag slide to new position, verify order updates and persists on reload
5. Delete slide via hover button, verify confirmation dialog, verify adjacent slide selected
6. Test with empty deck (no slides), verify empty state shown
7. Test with deck with no images, verify placeholders shown
8. Test keyboard navigation (Tab, Arrow keys, Enter)
9. Test URL deep linking with ?slide=slide-002
10. Test mobile responsive behavior
11. Test with 50+ slides for performance
12. Test error cases: failed API calls, network errors
