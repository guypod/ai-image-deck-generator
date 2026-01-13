import PptxGenJS from 'pptxgenjs';
import { Automizer } from 'pptx-automizer';
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
    const shouldHaveImage = !slideData.noImages;
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
 * Export without template using PptxGenJS (fallback/default)
 */
async function exportWithoutTemplate(deck, slidesToExport, deckId, storageDir, title, onProgress) {
  // Create new presentation
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.author = 'AI Image Deck Generator';
  pptx.title = title;
  pptx.subject = deck.name;
  pptx.layout = 'LAYOUT_WIDE'; // 16:9 aspect ratio

  console.log(`Creating PowerPoint with ${slidesToExport.length} slides (no template)...`);

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
    const shouldHaveImage = !slideData.noImages;
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

/**
 * Export with template using pptx-automizer
 */
async function exportWithTemplate(deck, slidesToExport, deckId, storageDir, title, templatePath, templateSlideIndex, onProgress) {
  console.log(`Creating PowerPoint with ${slidesToExport.length} slides using template: ${templatePath}`);

  const tempDir = path.join(os.tmpdir(), 'ai-image-deck-exports');
  await fs.mkdir(tempDir, { recursive: true });

  // Initialize Automizer
  const automizer = new Automizer({
    templateDir: path.dirname(templatePath),
    outputDir: tempDir,
    removeExistingSlides: false, // Keep template slides, append new slides
    compression: 0,
    verbosity: 0
  });

  // Load template
  const templateName = path.basename(templatePath);
  let pres = automizer
    .loadRoot(templateName)
    .load(templateName, 'template');

  // Process each slide
  for (let i = 0; i < slidesToExport.length; i++) {
    const slideData = slidesToExport[i];

    if (onProgress) {
      onProgress(i + 1, slidesToExport.length);
    }

    console.log(`Processing slide ${i + 1}/${slidesToExport.length}: ${slideData.id}`);

    // Clone template slide and add content
    pres.addSlide('template', templateSlideIndex, async (slide) => {
      // Determine if slide should have image
      const shouldHaveImage = !slideData.noImages;
      const pinnedImage = slideData.generatedImages?.find(img => img.isPinned);

      if (shouldHaveImage && pinnedImage) {
        const imagePath = path.join(storageDir, `deck-${deckId}`, slideData.id, pinnedImage.filename);

        try {
          const imageBuffer = await fs.readFile(imagePath);
          const base64Image = imageBuffer.toString('base64');
          const mimeType = pinnedImage.filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

          // Use PptxGenJS wrapper to add full-slide cover image on top of template
          slide.generate((pptxGenJSSlide) => {
            pptxGenJSSlide.addImage({
              data: `data:${mimeType};base64,${base64Image}`,
              x: 0,
              y: 0,
              w: '100%',
              h: '100%',
              sizing: { type: 'cover', w: '100%', h: '100%' }
            });
          });
        } catch (err) {
          console.error(`Failed to add image for slide ${i + 1}:`, err.message);
        }
      }
      // Note: Speaker notes are not currently supported with template-based exports
      // The template slide is cloned as-is, and pptx-automizer's PptxGenJS wrapper
      // doesn't expose addNotes(). This could be added via XML manipulation if needed.
    });
  }

  // Generate output as buffer
  const jszip = await pres.getJSZip();
  const buffer = await jszip.generateAsync({ type: 'nodebuffer' });

  // Generate filename
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const fileName = `${sanitizedTitle}_${timestamp}.pptx`;

  console.log(`PowerPoint generated with template: ${fileName} (${buffer.length} bytes)`);

  return {
    buffer,
    fileName,
    slideCount: slidesToExport.length
  };
}

/**
 * Check if template file exists and is valid
 */
async function checkTemplateFile(templatePath) {
  if (!templatePath) {
    return false;
  }

  try {
    await fs.access(templatePath);
    // Verify it's a PPTX file
    const ext = path.extname(templatePath).toLowerCase();
    if (ext !== '.pptx') {
      console.warn(`Template file is not a .pptx: ${templatePath}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Template file not accessible: ${templatePath}`, err.message);
    return false;
  }
}

/**
 * Export and return as buffer (for streaming download)
 * @param {Object} deck - Deck object
 * @param {Array} slides - Array of slide objects
 * @param {string} deckId - Deck ID
 * @param {string} storageDir - Storage directory path
 * @param {string} title - Title for presentation
 * @param {Object} options - Additional options
 * @param {string} options.localTemplatePath - Path to PowerPoint template file (optional)
 * @param {number} options.templateSlideIndex - Which slide to use from template (1-based, default: 1)
 * @param {number} options.fromSlideIndex - Start export from this slide index (0-based)
 * @param {Function} options.onProgress - Progress callback: (current, total) => void
 * @returns {Object} - { buffer, fileName, slideCount }
 */
export async function exportToPowerPointBuffer(deck, slides, deckId, storageDir, title, options = {}) {
  const {
    localTemplatePath = null,
    templateSlideIndex = 1,
    fromSlideIndex = 0,
    onProgress = null
  } = options;

  // Sort slides by order and filter by fromSlideIndex
  const sortedSlides = [...slides].sort((a, b) => a.order - b.order);
  const slidesToExport = sortedSlides.slice(fromSlideIndex);

  if (slidesToExport.length === 0) {
    throw new Error('No slides to export');
  }

  // Check if we should use template-based export
  const useTemplate = await checkTemplateFile(localTemplatePath);

  if (useTemplate) {
    try {
      console.log('Using template-based export');
      return await exportWithTemplate(
        deck,
        slidesToExport,
        deckId,
        storageDir,
        title,
        localTemplatePath,
        templateSlideIndex,
        onProgress
      );
    } catch (err) {
      console.error('Template-based export failed, falling back to default:', err.message);
      // Fall through to default export
    }
  }

  // Default: export without template
  console.log('Using default export (no template)');
  return await exportWithoutTemplate(
    deck,
    slidesToExport,
    deckId,
    storageDir,
    title,
    onProgress
  );
}

export default {
  exportToPowerPoint,
  exportToPowerPointBuffer
};
