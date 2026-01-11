import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Retry wrapper for API calls with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms (doubles each retry)
 * @param {string} operationName - Name for logging
 */
// Rate limiting: Google Slides API has ~60 write requests per minute limit
// We'll add a delay between requests to stay under the limit
const RATE_LIMIT_DELAY_MS = 1200; // ~50 requests per minute to be safe
let lastApiCallTime = 0;

async function rateLimitedDelay() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  if (timeSinceLastCall < RATE_LIMIT_DELAY_MS) {
    const waitTime = RATE_LIMIT_DELAY_MS - timeSinceLastCall;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastApiCallTime = Date.now();
}

async function withRetry(fn, maxRetries = 3, baseDelay = 2000, operationName = 'API call') {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await rateLimitedDelay();
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = error.status === 429 || error.code === 429;
      const isRetryable =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        isRateLimit ||
        error.response?.status === 429 ||
        error.response?.status === 500 ||
        error.response?.status === 502 ||
        error.response?.status === 503 ||
        error.response?.status === 504;

      if (!isRetryable || attempt === maxRetries) {
        // Log detailed error info
        console.error(`${operationName} failed after ${attempt} attempt(s):`, {
          message: error.message,
          code: error.code,
          status: error.status || error.response?.status,
          statusText: error.response?.statusText,
          errors: error.errors
        });
        throw error;
      }

      // For rate limits, wait longer (60 seconds as recommended by Google)
      const delay = isRateLimit ? 60000 : baseDelay * Math.pow(2, attempt - 1);
      console.log(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * Extract presentation ID from Google Slides URL
 * @param {string} url - Google Slides URL
 * @returns {string} - Presentation ID
 */
function extractPresentationId(url) {
  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Slides URL');
  }
  return match[1];
}

/**
 * Initialize Google Slides API client
 * @param {Object|null} credentials - Google OAuth credentials (optional)
 * @returns {Object} - Slides API client
 */
async function initializeSlidesClient(credentials) {
  let auth;

  if (credentials) {
    // Use OAuth credentials if provided
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });

    auth = oauth2Client;
  } else {
    // Use application default credentials or API key from environment
    auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
  }

  return google.slides({ version: 'v1', auth });
}

/**
 * Initialize Google Drive API client
 * @param {Object|null} credentials - Google OAuth credentials (optional)
 * @returns {Object} - Drive API client
 */
async function initializeDriveClient(credentials) {
  let auth;

  if (credentials) {
    // Use OAuth credentials if provided
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });

    auth = oauth2Client;
  } else {
    // Use application default credentials or API key from environment
    auth = new google.auth.GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/presentations',
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
  }

  return google.drive({ version: 'v3', auth });
}

/**
 * Copy template presentation
 * @param {Object} driveClient - Drive API client
 * @param {string} templateId - Template presentation ID
 * @param {string} newTitle - Title for new presentation
 * @returns {string} - New presentation ID
 */
async function copyPresentation(driveClient, templateId, newTitle) {
  return withRetry(async () => {
    const response = await driveClient.files.copy({
      fileId: templateId,
      requestBody: {
        name: newTitle
      }
    });
    return response.data.id;
  }, 3, 2000, 'Copy presentation');
}

/**
 * Upload image to Google Drive
 * @param {Object} driveClient - Drive API client
 * @param {string} imagePath - Local path to image
 * @param {string} fileName - Name for uploaded file
 * @returns {string} - Uploaded file ID
 */
async function uploadImageToDrive(driveClient, imagePath, fileName) {
  const fileId = await withRetry(async () => {
    const response = await driveClient.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'image/jpeg'
      },
      media: {
        mimeType: 'image/jpeg',
        body: createReadStream(imagePath)
      }
    });
    return response.data.id;
  }, 3, 2000, 'Upload image to Drive');

  // Make the file publicly accessible
  await withRetry(async () => {
    await driveClient.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  }, 3, 2000, 'Set image permissions');

  return fileId;
}

/**
 * Create slide with full-screen image
 * @param {Object} slidesClient - Slides API client
 * @param {string} presentationId - Presentation ID
 * @param {string} slideId - ID of the slide to add image to
 * @param {string} imageUrl - URL of the image
 */
async function addImageToSlide(slidesClient, presentationId, slideId, imageUrl) {
  // Get presentation dimensions
  const presentation = await withRetry(async () => {
    return slidesClient.presentations.get({ presentationId });
  }, 3, 2000, 'Get presentation for image');

  const pageWidth = presentation.data.pageSize.width.magnitude;
  const pageHeight = presentation.data.pageSize.height.magnitude;

  const requests = [{
    createImage: {
      url: imageUrl,
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: pageWidth, unit: 'EMU' },
          height: { magnitude: pageHeight, unit: 'EMU' }
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: 0,
          translateY: 0,
          unit: 'EMU'
        }
      }
    }
  }];

  await withRetry(async () => {
    await slidesClient.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });
  }, 3, 2000, 'Add image to slide');
}

/**
 * Create slide with centered text
 * @param {Object} slidesClient - Slides API client
 * @param {string} presentationId - Presentation ID
 * @param {string} slideId - ID of the slide
 * @param {string} text - Text to display
 */
async function addTextToSlide(slidesClient, presentationId, slideId, text) {
  // Get presentation dimensions
  const presentation = await withRetry(async () => {
    return slidesClient.presentations.get({ presentationId });
  }, 3, 2000, 'Get presentation for text');

  const pageWidth = presentation.data.pageSize.width.magnitude;
  const pageHeight = presentation.data.pageSize.height.magnitude;

  // Create a text box in the center (60% width, 40% height, centered)
  const textBoxWidth = pageWidth * 0.6;
  const textBoxHeight = pageHeight * 0.4;
  const textBoxX = (pageWidth - textBoxWidth) / 2;
  const textBoxY = (pageHeight - textBoxHeight) / 2;

  const textBoxId = `textbox_${Date.now()}`;

  const requests = [
    {
      createShape: {
        objectId: textBoxId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: textBoxWidth, unit: 'EMU' },
            height: { magnitude: textBoxHeight, unit: 'EMU' }
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: textBoxX,
            translateY: textBoxY,
            unit: 'EMU'
          }
        }
      }
    },
    {
      insertText: {
        objectId: textBoxId,
        text: text
      }
    },
    {
      updateParagraphStyle: {
        objectId: textBoxId,
        style: {
          alignment: 'CENTER'
        },
        fields: 'alignment'
      }
    },
    {
      updateTextStyle: {
        objectId: textBoxId,
        style: {
          fontSize: {
            magnitude: 24,
            unit: 'PT'
          }
        },
        fields: 'fontSize'
      }
    }
  ];

  await withRetry(async () => {
    await slidesClient.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });
  }, 3, 2000, 'Add text to slide');
}

/**
 * Add speaker notes to a slide
 * @param {Object} slidesClient - Slides API client
 * @param {string} presentationId - Presentation ID
 * @param {string} slideId - Slide ID
 * @param {string} notes - Speaker notes text
 */
async function addSpeakerNotes(slidesClient, presentationId, slideId, notes) {
  try {
    console.log(`Adding speaker notes to slide ${slideId}...`);

    // Get the presentation with slide details
    const presentation = await withRetry(async () => {
      return slidesClient.presentations.get({ presentationId });
    }, 3, 2000, 'Get presentation for notes');

    const slide = presentation.data.slides.find(s => s.objectId === slideId);
    if (!slide || !slide.slideProperties || !slide.slideProperties.notesPage) {
      console.warn('Notes page not found for slide:', slideId);
      return;
    }

    const notesPageId = slide.slideProperties.notesPage.objectId;

    // Get the notes page
    const presentationWithNotes = await withRetry(async () => {
      return slidesClient.presentations.pages.get({
        presentationId,
        pageObjectId: notesPageId
      });
    }, 3, 2000, 'Get notes page');

    const notesPage = presentationWithNotes.data;
    if (!notesPage || !notesPage.pageElements) {
      console.warn('Notes page elements not found for slide:', slideId);
      return;
    }

    // Find the notes shape - look for a shape with a TEXT placeholder
    let notesShapeId = null;
    for (const element of notesPage.pageElements) {
      if (element.shape && element.shape.placeholder &&
          element.shape.placeholder.type === 'BODY') {
        notesShapeId = element.objectId;
        break;
      }
    }

    // If not found by placeholder, try the second element (common pattern)
    if (!notesShapeId && notesPage.pageElements.length >= 2) {
      notesShapeId = notesPage.pageElements[1].objectId;
    }

    if (!notesShapeId) {
      console.warn('Notes shape not found for slide:', slideId);
      return;
    }

    // Check if the notes shape has existing text
    const notesShape = notesPage.pageElements.find(e => e.objectId === notesShapeId);
    const hasExistingText = notesShape?.shape?.text?.textElements?.some(
      el => el.textRun && el.textRun.content.trim().length > 0
    );

    const requests = [];

    // Only delete if there's existing text
    if (hasExistingText) {
      requests.push({
        deleteText: {
          objectId: notesShapeId,
          textRange: {
            type: 'ALL'
          }
        }
      });
    }

    requests.push({
      insertText: {
        objectId: notesShapeId,
        text: notes,
        insertionIndex: 0
      }
    });

    await withRetry(async () => {
      await slidesClient.presentations.batchUpdate({
        presentationId,
        requestBody: { requests }
      });
    }, 3, 2000, 'Add speaker notes');
    console.log(`Successfully added speaker notes to slide ${slideId}`);
  } catch (error) {
    console.error('Error adding speaker notes to slide', slideId, ':', error.message);
    // Don't throw - speaker notes are not critical
  }
}

/**
 * Export deck to Google Slides with incremental progress tracking
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {Object} credentials - Google OAuth credentials
 * @param {string} templateUrl - Template presentation URL
 * @param {string} title - Title for new presentation
 * @param {number} templateSlideIndex - Slide index (1-based) in template to use as base
 * @param {Object} options - Additional options
 * @param {number} options.fromSlideIndex - Start export from this slide index (0-based)
 * @param {Object} options.existingState - Existing export state for resume
 * @param {Function} options.onProgress - Progress callback: (state) => void
 * @param {Function} options.saveState - State persistence callback: (state) => Promise<void>
 * @returns {Object} - { presentationId, url, exportedSlideCount }
 */
export async function exportToGoogleSlides(deck, slides, deckId, storageDir, credentials, templateUrl, title, templateSlideIndex = 1, options = {}) {
  const {
    fromSlideIndex = 0,
    existingState = null,
    onProgress = null,
    saveState = null
  } = options;

  if (!templateUrl) {
    throw new Error('Template slide URL not configured. Please add it in settings.');
  }

  // Use credentials from settings, or fall back to environment variables
  let authCredentials = credentials;

  if (!authCredentials && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
    authCredentials = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN
    };
  }

  const slidesClient = await initializeSlidesClient(authCredentials);
  const driveClient = await initializeDriveClient(authCredentials);

  // Sort slides by order and filter by fromSlideIndex
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const slidesToExport = sortedSlides.slice(fromSlideIndex);

  if (slidesToExport.length === 0) {
    throw new Error('No slides to export');
  }

  let state;
  let newPresentationId;
  let slideIds = [];

  // Check if we're resuming from existing state
  if (existingState && existingState.presentationId) {
    console.log(`Resuming export from existing state. Last processed: ${existingState.lastProcessedSlide}`);
    state = existingState;
    newPresentationId = existingState.presentationId;
    slideIds = existingState.slideIds || [];
  } else {
    // Create new presentation
    console.log(`Creating new presentation: ${title}`);
    const templateId = extractPresentationId(templateUrl);
    newPresentationId = await copyPresentation(driveClient, templateId, title);

    const presentationUrl = `https://docs.google.com/presentation/d/${newPresentationId}`;

    // Initialize state
    state = {
      presentationId: newPresentationId,
      presentationUrl,
      title,
      slideIds: [],
      lastProcessedSlide: -1,
      totalSlides: slidesToExport.length,
      phase: 'creating_slides',
      fromSlideIndex,
      startedAt: new Date().toISOString()
    };

    if (saveState) {
      await saveState(state);
    }
    if (onProgress) {
      onProgress(state);
    }

    // Get the presentation to find existing slides
    const presentation = await withRetry(async () => {
      return slidesClient.presentations.get({ presentationId: newPresentationId });
    }, 3, 2000, 'Get presentation');

    // Get the template slide to duplicate (convert 1-based index to 0-based)
    const templateSlides = presentation.data.slides;
    const templateSlideIndexZeroBased = templateSlideIndex - 1;

    if (templateSlideIndexZeroBased < 0 || templateSlideIndexZeroBased >= templateSlides.length) {
      throw new Error(`Template slide index ${templateSlideIndex} is out of range. Template has ${templateSlides.length} slide(s).`);
    }

    const templateSlideId = templateSlides[templateSlideIndexZeroBased].objectId;

    // Create all slides first (duplicate and position)
    console.log(`Creating ${slidesToExport.length} slides...`);
    for (let i = 0; i < slidesToExport.length; i++) {
      // Duplicate the slide
      const duplicateResponse = await withRetry(async () => {
        return slidesClient.presentations.batchUpdate({
          presentationId: newPresentationId,
          requestBody: {
            requests: [{
              duplicateObject: {
                objectId: templateSlideId,
                objectIds: {}
              }
            }]
          }
        });
      }, 3, 2000, `Duplicate slide ${i + 1}`);

      const newSlideId = duplicateResponse.data.replies[0].duplicateObject.objectId;
      slideIds.push(newSlideId);

      // Move the duplicated slide to position i (at the beginning)
      await withRetry(async () => {
        return slidesClient.presentations.batchUpdate({
          presentationId: newPresentationId,
          requestBody: {
            requests: [{
              updateSlidesPosition: {
                slideObjectIds: [newSlideId],
                insertionIndex: i
              }
            }]
          }
        });
      }, 3, 2000, `Position slide ${i + 1}`);

      // Update state after each slide creation
      state.slideIds = slideIds;
      state.phase = 'creating_slides';

      if (saveState) {
        await saveState(state);
      }
      if (onProgress) {
        onProgress({ ...state, createdSlides: i + 1 });
      }

      console.log(`Created slide ${i + 1}/${slidesToExport.length}`);
    }

    // Move to processing phase
    state.phase = 'processing_slides';
    if (saveState) {
      await saveState(state);
    }
  }

  // Process each slide (can resume from lastProcessedSlide)
  const startIndex = state.lastProcessedSlide + 1;
  console.log(`Processing slides starting from index ${startIndex}...`);

  for (let i = startIndex; i < slidesToExport.length; i++) {
    const slide = slidesToExport[i];
    const slideId = slideIds[i];

    console.log(`Processing slide ${i + 1}/${slidesToExport.length}: ${slide.id}`);

    // Determine if slide should have image
    const shouldHaveImage = !slide.noImages && !slide.sceneStart;
    const pinnedImage = slide.generatedImages?.find(img => img.isPinned);
    const hasImage = shouldHaveImage && pinnedImage;

    if (hasImage) {
      // Upload image to Drive and add to slide
      const imagePath = path.join(storageDir, `deck-${deckId}`, slide.id, pinnedImage.filename);
      console.log(`Uploading image: ${imagePath}`);
      const imageFileId = await uploadImageToDrive(driveClient, imagePath, `${slide.id}_${pinnedImage.filename}`);
      const imageUrl = `https://drive.google.com/uc?export=view&id=${imageFileId}`;

      await addImageToSlide(slidesClient, newPresentationId, slideId, imageUrl);
    } else {
      // Add centered text box with speaker notes
      await addTextToSlide(slidesClient, newPresentationId, slideId, slide.speakerNotes || 'No content');
    }

    // Add speaker notes
    const speakerNotesText = slide.speakerNotes + '\n\n---\n\n' + (slide.imageDescription || 'No description');
    await addSpeakerNotes(slidesClient, newPresentationId, slideId, speakerNotesText);

    // Update state after each slide is fully processed
    state.lastProcessedSlide = i;
    if (saveState) {
      await saveState(state);
    }
    if (onProgress) {
      onProgress({ ...state, currentSlide: i + 1 });
    }

    console.log(`Completed slide ${i + 1}/${slidesToExport.length}`);
  }

  // Mark as complete
  state.phase = 'complete';
  if (saveState) {
    await saveState(state);
  }
  if (onProgress) {
    onProgress(state);
  }

  const presentationUrl = `https://docs.google.com/presentation/d/${newPresentationId}`;

  return {
    presentationId: newPresentationId,
    url: presentationUrl,
    exportedSlideCount: slidesToExport.length
  };
}

export default {
  exportToGoogleSlides
};
