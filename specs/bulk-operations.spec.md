---
name: Bulk Operations
description: Generate images for multiple slides in parallel
targets:
  - backend/src/routes/images.js
  - backend/src/utils/asyncPool.js
  - frontend/src/components/BulkActions.jsx
---

# Bulk Operations

## Overview

Users can generate images for multiple slides at once using "Generate All" and "Generate Missing" operations. These run in parallel with progress tracking.

## Functional Requirements

### Generate All

**User Flow:**
1. User is in deck editor viewing slide list
2. User clicks "Generate All" button
3. System shows dialog to select variant count and service
4. User confirms
5. System generates images for all slides in parallel
6. System shows progress indicator
7. User can see which slides are complete/pending/failed
8. When complete, system shows summary

**API:**
- `POST /api/decks/:deckId/generate-all`
- Request body: `{ "count": 2, "service": "google-imagen" }`
- Response: `{ "jobId": "job-uuid-123" }`

**Requirements:**
- Create job to track operation
- For each slide in deck:
  - Parse @entity references from imageDescription
  - Build full prompt from visualStyle + description
  - Generate specified number of variants
- Run generations in parallel with concurrency limit (5-10)
- Track progress: completed, failed, pending
- Handle partial failures (some slides succeed, others fail)
- Return job ID immediately
- User polls for status updates

[@test](../tests/backend/routes/images.test.js#generate-all) - Generate all API endpoint
[@test](../tests/backend/utils/asyncPool.test.js#bulk-generation) - Parallel bulk generation
[@test](../tests/frontend/components/BulkActions.test.js#generate-all) - Generate all UI

### Generate Missing

**User Flow:**
1. User is in deck editor with some slides having images, some without
2. User clicks "Generate Missing" button
3. System shows dialog to select variant count and service
4. User confirms
5. System generates images only for slides with no images
6. System shows progress indicator
7. When complete, system shows summary

**API:**
- `POST /api/decks/:deckId/generate-missing`
- Request body: `{ "count": 2, "service": "google-imagen" }`
- Response: `{ "jobId": "job-uuid-123" }`

**Requirements:**
- Create job to track operation
- Filter slides to only those with empty generatedImages array
- If no slides need images, return immediately with message
- For each slide without images:
  - Parse @entity references from imageDescription
  - Build full prompt from visualStyle + description
  - Generate specified number of variants
- Run generations in parallel with concurrency limit
- Track progress like generate-all
- Return job ID immediately

[@test](../tests/backend/routes/images.test.js#generate-missing) - Generate missing API endpoint
[@test](../tests/frontend/components/BulkActions.test.js#generate-missing) - Generate missing UI

### Check Job Status

**User Flow:**
1. User initiates bulk operation
2. UI polls job status every 2 seconds
3. UI shows progress bar and status updates
4. When complete, UI shows final results

**API:**
- `GET /api/jobs/:jobId`
- Response:
  ```json
  {
    "jobId": "job-uuid-123",
    "status": "running",
    "progress": {
      "total": 10,
      "completed": 7,
      "failed": 1,
      "pending": 2
    },
    "results": [
      {
        "slideId": "slide-001",
        "status": "success",
        "imageCount": 2
      },
      {
        "slideId": "slide-002",
        "status": "failed",
        "error": "API rate limit exceeded"
      }
    ]
  }
  ```

**Job Status Values:**
- `"running"` - In progress
- `"completed"` - All finished (may include failures)
- `"failed"` - Job failed to start or was cancelled

**Requirements:**
- Store job state in memory (or Redis for production)
- Update job state as slides complete
- Keep results for 1 hour after completion
- Clean up old jobs automatically
- Return 404 if job not found or expired

[@test](../tests/backend/routes/images.test.js#check-job-status) - Job status API endpoint

## Job Management

### Job Structure

```javascript
{
  jobId: "job-uuid-123",
  deckId: "deck-uuid-456",
  type: "generate-all" | "generate-missing",
  status: "running" | "completed" | "failed",
  createdAt: "2025-01-08T10:00:00.000Z",
  completedAt: null,
  config: {
    count: 2,
    service: "google-imagen"
  },
  progress: {
    total: 10,
    completed: 7,
    failed: 1,
    pending: 2
  },
  results: [
    {
      slideId: "slide-001",
      status: "success" | "failed",
      imageCount: 2,
      error: null
    }
  ]
}
```

### Job Storage

**In-Memory (Development):**
- Store jobs in Map: `jobId → job object`
- Clean up after 1 hour
- Lost on server restart (acceptable for MVP)

**Redis (Production):**
- Store job as JSON string with TTL of 1 hour
- Pub/sub for real-time updates (optional)
- Persistent across server restarts

[@test](../tests/backend/services/jobManager.test.js#create-job) - Job creation
[@test](../tests/backend/services/jobManager.test.js#update-progress) - Progress updates
[@test](../tests/backend/services/jobManager.test.js#cleanup) - Automatic cleanup

## Parallel Execution Strategy

### Concurrency Control

**Requirements:**
- Use p-limit to control concurrent AI API calls
- Limit: 5-10 concurrent requests (configurable)
- Queue remaining slides
- Process in order (slide order)

**Benefits:**
- Avoid rate limiting from AI services
- Prevent overwhelming the server
- Predictable resource usage

[@test](../tests/backend/utils/asyncPool.test.js#concurrency-limit) - Concurrency limiting

### Error Handling

**Partial Failures:**
- If some slides fail, continue processing others
- Mark failed slides in results
- Don't retry automatically (user can retry manually)
- Include error messages in results

**Complete Failure:**
- If job setup fails (e.g., invalid deck), return 400
- If all slides fail, mark job as completed with all failures
- Log errors for debugging

**Cancellation (Optional):**
- Allow user to cancel running job
- Stop generating new images
- Mark pending slides as cancelled
- Keep already generated images

[@test](../tests/backend/utils/asyncPool.test.js#partial-failures) - Partial failure handling

## Edge Cases

### Empty Deck
- If deck has no slides, return 400: "No slides in deck"
- Frontend disables buttons if no slides

### No Missing Images
- If all slides have images, generate-missing returns 200 with message
- Frontend shows: "All slides already have images"

### Duplicate Job Requests
- Allow multiple jobs per deck (no locking)
- Each job has unique ID
- Jobs run independently

### API Key Not Configured
- Check settings before starting job
- Return 400: "API key not configured for [service]"
- Don't create job

### Slides Without Description
- Skip slides with both visualStyle and imageDescription empty
- Mark as failed in results with message: "No description provided"
- Or use generic prompt (discuss with user)

## Validation

### Generate All Request
- count: integer, 1-10, required
- service: "google-imagen" | "openai-dalle", required
- deckId must exist
- Deck must have at least 1 slide

### Generate Missing Request
- Same as generate-all
- At least 1 slide must have no images

### Job ID
- Must be valid UUID
- Must exist in job storage
- Not expired (< 1 hour old)

## UI Components

### BulkActions Component
- "Generate All" button (primary)
- "Generate Missing" button (secondary)
- Show button states:
  - Disabled if no slides
  - Disabled if operation running
  - Show spinner if operation running
- Click button opens dialog

### BulkOperationDialog Component
- Modal dialog
- Title: "Generate All Images" or "Generate Missing Images"
- Variant count selector (1-10)
- Service selector (Google Imagen, OpenAI DALL-E)
- Summary: "Generate images for X slides"
- Start button
- Cancel button

### BulkProgressDialog Component
- Modal dialog (non-dismissible during operation)
- Progress bar (completed / total)
- Status text: "Generating images for 7 of 10 slides"
- List of slides with status icons:
  - ⏳ Pending
  - ✅ Success (with image count)
  - ❌ Failed (with error message)
- Close button (enabled when complete)
- Option to view results summary

### ResultsSummary Component
- Shows final results
- Success count: "8 slides generated successfully"
- Failure count: "2 slides failed"
- List of failed slides with errors
- "View Deck" button to return to deck editor

## Error Messages

- "No slides in deck" - Empty deck
- "All slides already have images" - Nothing to generate
- "API key not configured for [service]" - No API key
- "Job not found or expired" - Invalid job ID
- "Image generation failed for slide X: [error]" - Per-slide errors
- "Bulk operation cancelled" - User cancelled

## Verification

1. Create deck with 10 slides
2. Click "Generate All" with 2 variants
3. Verify progress updates in real-time
4. Verify all 10 slides get 2 images each (20 total images)
5. Verify images generated in parallel (check timestamps)
6. Test with some slides having empty descriptions (should fail gracefully)
7. Delete images from 5 slides
8. Click "Generate Missing"
9. Verify only 5 slides get new images
10. Test error case: invalid API key (all should fail)
11. Test partial failure: mock some API calls to fail
12. Verify failed slides shown with error messages
13. Test cancellation (optional): cancel mid-operation
14. Verify job cleanup after 1 hour
