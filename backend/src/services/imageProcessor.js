import sharp from 'sharp';

// Target dimensions for 16:9 aspect ratio
const TARGET_ASPECT_RATIO = 16 / 9;
const ASPECT_RATIO_TOLERANCE = 0.01; // 1% tolerance
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 720;
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Process and validate image
 * - Enforce 16:9 aspect ratio
 * - Convert to JPEG
 * - Optimize file size
 * - Validate dimensions and size
 * @param {Buffer} imageBuffer - Source image buffer
 * @returns {Promise<Buffer>} - Processed JPEG image buffer
 */
export async function processImage(imageBuffer) {
  try {
    // Load image with sharp
    let image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Validate file size
    if (imageBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`Image file size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    }

    // Validate minimum dimensions
    if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
      throw new Error(`Image dimensions too small. Minimum: ${MIN_WIDTH}x${MIN_HEIGHT}`);
    }

    // Check aspect ratio
    const currentAspectRatio = metadata.width / metadata.height;
    const aspectRatioDiff = Math.abs(currentAspectRatio - TARGET_ASPECT_RATIO);

    // If aspect ratio is outside tolerance, crop to 16:9
    if (aspectRatioDiff > ASPECT_RATIO_TOLERANCE) {
      const croppedDimensions = calculateCropDimensions(metadata.width, metadata.height);
      image = image.extract({
        left: croppedDimensions.left,
        top: croppedDimensions.top,
        width: croppedDimensions.width,
        height: croppedDimensions.height
      });
    }

    // Resize if too large
    if (metadata.width > MAX_WIDTH) {
      image = image.resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to JPEG with optimization
    const processedBuffer = await image
      .jpeg({
        quality: 90,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();

    return processedBuffer;
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Calculate crop dimensions to achieve 16:9 aspect ratio (center crop)
 * @param {number} width - Current width
 * @param {number} height - Current height
 * @returns {object} - {left, top, width, height}
 */
function calculateCropDimensions(width, height) {
  const currentAspectRatio = width / height;

  let cropWidth, cropHeight, left, top;

  if (currentAspectRatio > TARGET_ASPECT_RATIO) {
    // Image is too wide, crop width
    cropHeight = height;
    cropWidth = Math.round(height * TARGET_ASPECT_RATIO);
    left = Math.round((width - cropWidth) / 2);
    top = 0;
  } else {
    // Image is too tall, crop height
    cropWidth = width;
    cropHeight = Math.round(width / TARGET_ASPECT_RATIO);
    left = 0;
    top = Math.round((height - cropHeight) / 2);
  }

  return { left, top, width: cropWidth, height: cropHeight };
}

/**
 * Validate image buffer
 * @param {Buffer} imageBuffer - Image buffer to validate
 * @returns {Promise<boolean>} - True if valid
 */
export async function validateImage(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Check if it's a valid image
    if (!metadata.format) {
      return false;
    }

    // Check dimensions
    if (!metadata.width || !metadata.height) {
      return false;
    }

    if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
      return false;
    }

    if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get image metadata
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<object>} - Metadata
 */
export async function getImageMetadata(imageBuffer) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    aspectRatio: (metadata.width / metadata.height).toFixed(2),
    size: imageBuffer.length
  };
}

/**
 * Convert image to JPEG
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {number} quality - JPEG quality (1-100)
 * @returns {Promise<Buffer>} - JPEG buffer
 */
export async function convertToJPEG(imageBuffer, quality = 90) {
  return sharp(imageBuffer)
    .jpeg({ quality, progressive: true })
    .toBuffer();
}

/**
 * Resize image to specific dimensions
 * @param {Buffer} imageBuffer - Source image buffer
 * @param {number} width - Target width
 * @param {number} height - Target height
 * @returns {Promise<Buffer>} - Resized image buffer
 */
export async function resizeImage(imageBuffer, width, height) {
  return sharp(imageBuffer)
    .resize(width, height, { fit: 'inside' })
    .toBuffer();
}

export default {
  processImage,
  validateImage,
  getImageMetadata,
  convertToJPEG,
  resizeImage
};
