import Automizer from 'pptx-automizer';
import { google } from 'googleapis';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Initialize Google Drive API client
 */
async function initializeDriveClient(credentials) {
  let auth;

  if (credentials) {
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    );
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });
    auth = oauth2Client;
  } else {
    auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
  }

  return google.drive({ version: 'v3', auth });
}

/**
 * Extract presentation ID from Google Slides URL
 */
function extractPresentationId(url) {
  const match = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error('Invalid Google Slides URL');
  }
  return match[1];
}

/**
 * Download Google Slides template as PPTX
 * Caches the template locally for reuse
 */
async function downloadTemplateAsPptx(templateUrl, credentials, cacheDir) {
  const presentationId = extractPresentationId(templateUrl);
  const cachedPath = path.join(cacheDir, `template-${presentationId}.pptx`);

  // Check if we have a cached version (cache for 1 hour)
  try {
    const stats = await fs.stat(cachedPath);
    const ageMs = Date.now() - stats.mtimeMs;
    if (ageMs < 3600000) { // 1 hour
      console.log('Using cached template:', cachedPath);
      return cachedPath;
    }
  } catch (err) {
    // File doesn't exist, will download
  }

  console.log('Downloading template from Google Drive...');
  const driveClient = await initializeDriveClient(credentials);

  // Export the presentation as PPTX
  const response = await driveClient.files.export(
    {
      fileId: presentationId,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    },
    { responseType: 'stream' }
  );

  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });

  // Write to file
  return new Promise((resolve, reject) => {
    const dest = createWriteStream(cachedPath);
    response.data
      .on('error', reject)
      .pipe(dest)
      .on('finish', () => {
        console.log('Template downloaded:', cachedPath);
        resolve(cachedPath);
      })
      .on('error', reject);
  });
}

/**
 * Export deck to PowerPoint file using Google Slides template
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {string} title - Title for presentation
 * @param {Object} options - Additional options
 * @param {string} options.templateUrl - Google Slides template URL
 * @param {number} options.templateSlideIndex - Which slide in template to use (1-based)
 * @param {Object} options.credentials - Google OAuth credentials
 * @param {number} options.fromSlideIndex - Start export from this slide index (0-based)
 * @param {Function} options.onProgress - Progress callback: (current, total) => void
 * @returns {Object} - { buffer, fileName, slideCount }
 */
export async function exportToPowerPointBuffer(deck, slides, deckId, storageDir, title, options = {}) {
  const {
    templateUrl = null,
    templateSlideIndex = 1,
    credentials = null,
    fromSlideIndex = 0,
    onProgress = null
  } = options;

  // Sort slides by order and filter by fromSlideIndex
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const slidesToExport = sortedSlides.slice(fromSlideIndex);

  if (slidesToExport.length === 0) {
    throw new Error('No slides to export');
  }

  console.log(`Creating PowerPoint with ${slidesToExport.length} slides...`);

  // Temp directory for template cache
  const tempDir = path.join(os.tmpdir(), 'ai-image-deck-exports');
  await fs.mkdir(tempDir, { recursive: true });

  let templatePath = null;

  // Try to download template if URL is provided
  if (templateUrl && credentials) {
    try {
      templatePath = await downloadTemplateAsPptx(templateUrl, credentials, tempDir);
    } catch (err) {
      console.warn('Failed to download template, will create blank presentation:', err.message);
    }
  }

  // Create automizer instance
  const automizer = new Automizer({
    templateDir: templatePath ? path.dirname(templatePath) : tempDir,
    outputDir: tempDir,
    removeExistingSlides: true // Start fresh
  });

  let pres;

  if (templatePath) {
    // Use downloaded template
    console.log('Using template:', templatePath);
    pres = automizer.loadRoot(path.basename(templatePath))
      .load(path.basename(templatePath), 'template');
  } else {
    // Create a minimal blank template if no template available
    console.log('No template available, creating blank presentation');
    // Fall back to pptxgenjs for blank presentations
    return await createBlankPresentation(slidesToExport, deckId, storageDir, title, onProgress);
  }

  // Convert 1-based to 0-based index
  const slideIndex = templateSlideIndex - 1;

  // Add slides from template
  for (let i = 0; i < slidesToExport.length; i++) {
    const slideData = slidesToExport[i];

    if (onProgress) {
      onProgress(i + 1, slidesToExport.length);
    }

    console.log(`Processing slide ${i + 1}/${slidesToExport.length}: ${slideData.id}`);

    // Add slide from template
    pres.addSlide('template', slideIndex + 1, async (slide) => {
      // Determine if slide should have image
      const shouldHaveImage = !slideData.noImages && !slideData.sceneStart;
      const pinnedImage = slideData.generatedImages?.find(img => img.isPinned);
      const hasImage = shouldHaveImage && pinnedImage;

      if (hasImage) {
        const imagePath = path.join(storageDir, `deck-${deckId}`, slideData.id, pinnedImage.filename);
        try {
          // Add image as background
          slide.addElement('image', {
            file: imagePath,
            x: 0,
            y: 0,
            w: '100%',
            h: '100%'
          });
        } catch (err) {
          console.error(`Failed to add image for slide ${i + 1}:`, err.message);
        }
      }

      // Note: pptx-automizer has limited support for modifying text/notes
      // The template styling will be preserved
    });
  }

  // Generate output
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `${sanitizedTitle}_${timestamp}.pptx`;

  const outputPath = path.join(tempDir, fileName);
  await pres.write(fileName);

  // Read the generated file
  const buffer = await fs.readFile(outputPath);

  // Cleanup
  try {
    await fs.unlink(outputPath);
  } catch (err) {
    // Ignore cleanup errors
  }

  console.log(`PowerPoint generated: ${fileName} (${buffer.length} bytes)`);

  return {
    buffer,
    fileName,
    slideCount: slidesToExport.length
  };
}

/**
 * Create a blank presentation without template (fallback)
 */
async function createBlankPresentation(slidesToExport, deckId, storageDir, title, onProgress) {
  // Dynamic import to avoid loading if not needed
  const PptxGenJS = (await import('pptxgenjs')).default;

  const pptx = new PptxGenJS();
  pptx.author = 'AI Image Deck Generator';
  pptx.title = title;
  pptx.layout = 'LAYOUT_WIDE';

  for (let i = 0; i < slidesToExport.length; i++) {
    const slideData = slidesToExport[i];

    if (onProgress) {
      onProgress(i + 1, slidesToExport.length);
    }

    const slide = pptx.addSlide();

    const shouldHaveImage = !slideData.noImages && !slideData.sceneStart;
    const pinnedImage = slideData.generatedImages?.find(img => img.isPinned);
    const hasImage = shouldHaveImage && pinnedImage;

    if (hasImage) {
      const imagePath = path.join(storageDir, `deck-${deckId}`, slideData.id, pinnedImage.filename);
      try {
        const imageBuffer = await fs.readFile(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = pinnedImage.filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

        slide.addImage({
          data: `data:${mimeType};base64,${base64Image}`,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
          sizing: { type: 'cover', w: '100%', h: '100%' }
        });
      } catch (err) {
        console.error(`Failed to add image for slide ${i + 1}:`, err.message);
        slide.addText(slideData.speakerNotes || 'No content', {
          x: '10%', y: '30%', w: '80%', h: '40%',
          fontSize: 24, align: 'center', valign: 'middle',
          fontFace: 'Arial', color: '333333', wrap: true
        });
      }
    } else {
      slide.addText(slideData.speakerNotes || 'No content', {
        x: '10%', y: '30%', w: '80%', h: '40%',
        fontSize: 24, align: 'center', valign: 'middle',
        fontFace: 'Arial', color: '333333', wrap: true
      });
    }

    const speakerNotesText = slideData.speakerNotes + '\n\n---\n\n' + (slideData.imageDescription || 'No description');
    slide.addNotes(speakerNotesText);
  }

  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `${sanitizedTitle}_${timestamp}.pptx`;

  const buffer = await pptx.write({ outputType: 'nodebuffer' });

  return {
    buffer,
    fileName,
    slideCount: slidesToExport.length
  };
}

export default {
  exportToPowerPointBuffer
};
