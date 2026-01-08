import axios from 'axios';
import sharp from 'sharp';

/**
 * Google Gemini Nano Banana Image Generation Service
 *
 * Supports two models:
 * - gemini-2.5-flash-image: Fast, efficient, high-volume
 * - gemini-3-pro-image-preview: Professional quality with advanced reasoning
 *
 * Features:
 * - Text-to-image generation
 * - Image editing with text prompts
 * - Native 16:9 aspect ratio support
 * - Resolutions: 1K, 2K, 4K
 * - Google Search grounding
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Model options
export const MODELS = {
  FLASH: 'gemini-2.5-flash-image',
  PRO: 'gemini-3-pro-image-preview',
};

// Resolution options
export const RESOLUTIONS = {
  '1K': '1K',
  '2K': '2K',
  '4K': '4K',
};

/**
 * Retry utility with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Generate an image using Gemini Nano Banana
 *
 * @param {string} prompt - Text description of the image
 * @param {object} options - Generation options
 * @param {string} options.apiKey - Google AI API key
 * @param {string} options.model - Model to use (FLASH or PRO)
 * @param {string} options.aspectRatio - Aspect ratio (default: "16:9")
 * @param {string} options.resolution - Resolution (default: "2K")
 * @param {Buffer} options.referenceImage - Optional reference image for editing
 * @param {boolean} options.useGoogleSearch - Enable Google Search grounding
 * @returns {Promise<Buffer>} - Image buffer (PNG format)
 */
export async function generateImage(prompt, options = {}) {
  const {
    apiKey,
    model = MODELS.FLASH,
    aspectRatio = '16:9',
    resolution = '2K',
    referenceImage = null,
    useGoogleSearch = false,
  } = options;

  if (!apiKey) {
    throw new Error('Google AI API key is required');
  }

  return retryWithBackoff(async () => {
    const url = `${BASE_URL}/models/${model}:generateContent`;

    // Build request contents
    const contents = [];

    if (referenceImage) {
      // Image editing: include reference image
      const base64Image = referenceImage.toString('base64');
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: 'image/png',
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      });
    } else {
      // Text-to-image: just text prompt
      contents.push({
        parts: [
          {
            text: prompt,
          },
        ],
      });
    }

    // Build generation config
    // Note: imageConfig with aspectRatio/imageSize is not currently supported by the API
    // Images are generated at a default resolution
    const generationConfig = {
      responseModalities: ['IMAGE'],
    };

    // Build request body
    const requestBody = {
      contents,
      generationConfig,
    };

    // Add Google Search grounding if enabled
    if (useGoogleSearch) {
      requestBody.tools = [
        {
          google_search_retrieval: {
            dynamic_retrieval_config: {
              mode: 'unspecified',
              dynamic_threshold: 0.7,
            },
          },
        },
      ];
    }

    // Make API request
    const response = await axios.post(url, requestBody, {
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minute timeout
    });

    // Extract image from response
    if (!response.data?.candidates?.[0]?.content?.parts) {
      throw new Error('No image generated in response');
    }

    const parts = response.data.candidates[0].content.parts;
    const imagePart = parts.find(part => part.inlineData);

    if (!imagePart) {
      throw new Error('No image data found in response');
    }

    // Decode base64 image
    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

    // Convert to PNG if needed (Gemini returns various formats)
    const pngBuffer = await sharp(imageBuffer)
      .png()
      .toBuffer();

    return pngBuffer;
  }, 3, 1000);
}

/**
 * Edit an existing image using Gemini Nano Banana
 *
 * @param {Buffer} sourceImage - Source image buffer
 * @param {string} editPrompt - Description of desired changes
 * @param {object} options - Generation options (same as generateImage)
 * @returns {Promise<Buffer>} - Edited image buffer
 */
export async function editImage(sourceImage, editPrompt, options = {}) {
  return generateImage(editPrompt, {
    ...options,
    referenceImage: sourceImage,
  });
}

/**
 * Test API key validity
 *
 * @param {string} apiKey - Google AI API key
 * @returns {Promise<{valid: boolean, message: string}>}
 */
export async function testApiKey(apiKey) {
  try {
    // Test with a simple prompt
    await generateImage('A simple test image', {
      apiKey,
      model: MODELS.FLASH,
      resolution: '1K', // Use smallest resolution for testing
    });

    return {
      valid: true,
      message: 'API key is valid and working',
    };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    return {
      valid: false,
      message: `API key test failed: ${message}`,
    };
  }
}

export default {
  generateImage,
  editImage,
  testApiKey,
  MODELS,
  RESOLUTIONS,
};
