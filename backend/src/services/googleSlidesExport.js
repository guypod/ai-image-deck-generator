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
  const response = await driveClient.files.copy({
    fileId: templateId,
    requestBody: {
      name: newTitle
    }
  });

  return response.data.id;
}

/**
 * Upload image to Google Drive
 * @param {Object} driveClient - Drive API client
 * @param {string} imagePath - Local path to image
 * @param {string} fileName - Name for uploaded file
 * @returns {string} - Uploaded file ID
 */
async function uploadImageToDrive(driveClient, imagePath, fileName) {
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

  // Make the file publicly accessible
  await driveClient.permissions.create({
    fileId: response.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  return response.data.id;
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
  const presentation = await slidesClient.presentations.get({
    presentationId
  });

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

  await slidesClient.presentations.batchUpdate({
    presentationId,
    requestBody: { requests }
  });
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
  const presentation = await slidesClient.presentations.get({
    presentationId
  });

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

  await slidesClient.presentations.batchUpdate({
    presentationId,
    requestBody: { requests }
  });
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
    console.log(`Notes content (${notes.length} chars):`, notes.substring(0, 100) + '...');

    // Get the presentation with slide details
    const presentation = await slidesClient.presentations.get({
      presentationId
    });

    const slide = presentation.data.slides.find(s => s.objectId === slideId);
    if (!slide || !slide.slideProperties || !slide.slideProperties.notesPage) {
      console.warn('Notes page not found for slide:', slideId);
      return;
    }

    const notesPageId = slide.slideProperties.notesPage.objectId;
    console.log(`Found notes page ID: ${notesPageId}`);

    // Get the presentation again with the notes page included
    const presentationWithNotes = await slidesClient.presentations.pages.get({
      presentationId,
      pageObjectId: notesPageId
    });

    const notesPage = presentationWithNotes.data;
    if (!notesPage || !notesPage.pageElements) {
      console.warn('Notes page elements not found for slide:', slideId);
      console.warn('Notes page data:', JSON.stringify(notesPage, null, 2));
      return;
    }

    console.log(`Notes page has ${notesPage.pageElements.length} elements`);

    // Find the notes shape - look for a shape with a TEXT placeholder
    let notesShapeId = null;
    for (const element of notesPage.pageElements) {
      console.log(`Element ${element.objectId}: type=${element.shape?.placeholder?.type}, shape=${!!element.shape}`);
      if (element.shape && element.shape.placeholder &&
          element.shape.placeholder.type === 'BODY') {
        notesShapeId = element.objectId;
        console.log(`Found notes shape by BODY placeholder: ${notesShapeId}`);
        break;
      }
    }

    // If not found by placeholder, try the second element (common pattern)
    if (!notesShapeId && notesPage.pageElements.length >= 2) {
      notesShapeId = notesPage.pageElements[1].objectId;
      console.log(`Using second element as notes shape: ${notesShapeId}`);
    }

    if (!notesShapeId) {
      console.warn('Notes shape not found for slide:', slideId);
      console.warn('Available elements:', JSON.stringify(notesPage.pageElements.map(e => ({
        id: e.objectId,
        type: e.shape?.placeholder?.type,
        hasShape: !!e.shape
      })), null, 2));
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

    console.log(`Executing batchUpdate to add notes to shape ${notesShapeId} (hasExistingText: ${hasExistingText})`);
    await slidesClient.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });
    console.log(`Successfully added speaker notes to slide ${slideId}`);
  } catch (error) {
    console.error('Error adding speaker notes to slide', slideId, ':', error.message);
    console.error('Full error:', error);
  }
}

/**
 * Export deck to Google Slides
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {Object} credentials - Google OAuth credentials
 * @param {string} templateUrl - Template presentation URL
 * @param {string} title - Title for new presentation
 * @returns {Object} - { presentationId, url }
 */
export async function exportToGoogleSlides(deck, slides, deckId, storageDir, credentials, templateUrl, title) {
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

  // Extract template ID and copy presentation
  const templateId = extractPresentationId(templateUrl);
  const newPresentationId = await copyPresentation(driveClient, templateId, title);

  // Get the presentation to find existing slides
  const presentation = await slidesClient.presentations.get({
    presentationId: newPresentationId
  });

  // Sort slides by order
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);

  // Create new slides for each deck slide
  const slideIds = [];
  for (let i = 0; i < sortedSlides.length; i++) {
    const requests = [{
      createSlide: {
        insertionIndex: i
      }
    }];

    const response = await slidesClient.presentations.batchUpdate({
      presentationId: newPresentationId,
      requestBody: { requests }
    });

    slideIds.push(response.data.replies[0].createSlide.objectId);
  }

  // Process each slide
  for (let i = 0; i < sortedSlides.length; i++) {
    const slide = sortedSlides[i];
    const slideId = slideIds[i];

    // Determine if slide should have image
    const shouldHaveImage = !slide.noImages && !slide.sceneStart;
    const pinnedImage = slide.generatedImages?.find(img => img.isPinned);
    const hasImage = shouldHaveImage && pinnedImage;

    if (hasImage) {
      // Upload image to Drive and add to slide
      const imagePath = path.join(storageDir, `deck-${deckId}`, slide.id, pinnedImage.filename);
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
  }

  const presentationUrl = `https://docs.google.com/presentation/d/${newPresentationId}`;

  return {
    presentationId: newPresentationId,
    url: presentationUrl
  };
}

export default {
  exportToGoogleSlides
};
