import PptxGenJS from 'pptxgenjs';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Export deck to PowerPoint file
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {string} title - Title for presentation
 * @param {Object} options - Additional options
 * @param {number} options.fromSlideIndex - Start export from this slide index (0-based)
 * @param {Function} options.onProgress - Progress callback: (current, total) => void
 * @returns {Object} - { filePath, fileName }
 */
export async function exportToPowerPoint(deck, slides, deckId, storageDir, title, options = {}) {
  const {
    fromSlideIndex = 0,
    onProgress = null
  } = options;

  // Sort slides by order and filter by fromSlideIndex
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const slidesToExport = sortedSlides.slice(fromSlideIndex);

  if (slidesToExport.length === 0) {
    throw new Error('No slides to export');
  }

  // Create new presentation
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.author = 'AI Image Deck Generator';
  pptx.title = title;
  pptx.subject = deck.name;
  pptx.layout = 'LAYOUT_WIDE'; // 16:9 aspect ratio

  console.log(`Creating PowerPoint with ${slidesToExport.length} slides...`);

  // Process each slide
  for (let i = 0; i < slidesToExport.length; i++) {
    const slideData = slidesToExport[i];

    if (onProgress) {
      onProgress(i + 1, slidesToExport.length);
    }

    console.log(`Processing slide ${i + 1}/${slidesToExport.length}: ${slideData.id}`);

    // Create slide
    const slide = pptx.addSlide();

    // Determine if slide should have image
    const shouldHaveImage = !slideData.noImages && !slideData.sceneStart;
    const pinnedImage = slideData.generatedImages?.find(img => img.isPinned);
    const hasImage = shouldHaveImage && pinnedImage;

    if (hasImage) {
      // Add full-slide image
      const imagePath = path.join(storageDir, `deck-${deckId}`, slideData.id, pinnedImage.filename);

      try {
        // Read image and convert to base64
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
        // Fall back to text if image fails
        addTextSlide(slide, slideData.speakerNotes || 'No content');
      }
    } else {
      // Add centered text box with speaker notes
      addTextSlide(slide, slideData.speakerNotes || 'No content');
    }

    // Add speaker notes
    const speakerNotesText = slideData.speakerNotes + '\n\n---\n\n' + (slideData.imageDescription || 'No description');
    slide.addNotes(speakerNotesText);
  }

  // Generate filename and save
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `${sanitizedTitle}_${timestamp}.pptx`;

  // Save to temp directory first, then move to downloads or return path
  const tempDir = path.join(os.tmpdir(), 'ai-image-deck-exports');
  await fs.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, fileName);

  // Write the file
  await pptx.writeFile({ fileName: filePath });

  console.log(`PowerPoint saved to: ${filePath}`);

  return {
    filePath,
    fileName,
    slideCount: slidesToExport.length
  };
}

/**
 * Add a text-only slide with centered content
 */
function addTextSlide(slide, text) {
  slide.addText(text, {
    x: '10%',
    y: '30%',
    w: '80%',
    h: '40%',
    fontSize: 24,
    align: 'center',
    valign: 'middle',
    fontFace: 'Arial',
    color: '333333',
    wrap: true
  });
}

/**
 * Export and return as buffer (for streaming download)
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {string} title - Title for presentation
 * @param {Object} options - Additional options
 * @returns {Object} - { buffer, fileName }
 */
export async function exportToPowerPointBuffer(deck, slides, deckId, storageDir, title, options = {}) {
  const {
    fromSlideIndex = 0,
    onProgress = null
  } = options;

  // Sort slides by order and filter by fromSlideIndex
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const slidesToExport = sortedSlides.slice(fromSlideIndex);

  if (slidesToExport.length === 0) {
    throw new Error('No slides to export');
  }

  // Create new presentation
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.author = 'AI Image Deck Generator';
  pptx.title = title;
  pptx.subject = deck.name;
  pptx.layout = 'LAYOUT_WIDE'; // 16:9 aspect ratio

  console.log(`Creating PowerPoint with ${slidesToExport.length} slides...`);

  // Process each slide
  for (let i = 0; i < slidesToExport.length; i++) {
    const slideData = slidesToExport[i];

    if (onProgress) {
      onProgress(i + 1, slidesToExport.length);
    }

    console.log(`Processing slide ${i + 1}/${slidesToExport.length}: ${slideData.id}`);

    // Create slide
    const slide = pptx.addSlide();

    // Determine if slide should have image
    const shouldHaveImage = !slideData.noImages && !slideData.sceneStart;
    const pinnedImage = slideData.generatedImages?.find(img => img.isPinned);
    const hasImage = shouldHaveImage && pinnedImage;

    if (hasImage) {
      // Add full-slide image
      const imagePath = path.join(storageDir, `deck-${deckId}`, slideData.id, pinnedImage.filename);

      try {
        // Read image and convert to base64
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
        // Fall back to text if image fails
        addTextSlide(slide, slideData.speakerNotes || 'No content');
      }
    } else {
      // Add centered text box with speaker notes
      addTextSlide(slide, slideData.speakerNotes || 'No content');
    }

    // Add speaker notes
    const speakerNotesText = slideData.speakerNotes + '\n\n---\n\n' + (slideData.imageDescription || 'No description');
    slide.addNotes(speakerNotesText);
  }

  // Generate filename
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `${sanitizedTitle}_${timestamp}.pptx`;

  // Get as buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' });

  console.log(`PowerPoint generated: ${fileName} (${buffer.length} bytes)`);

  return {
    buffer,
    fileName,
    slideCount: slidesToExport.length
  };
}

export default {
  exportToPowerPoint,
  exportToPowerPointBuffer
};
