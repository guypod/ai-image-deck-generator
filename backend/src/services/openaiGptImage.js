import OpenAI from 'openai';
import { retryWithBackoff } from '../utils/asyncPool.js';

/**
 * OpenAI DALL-E Image Generation Service
 *
 * Uses OpenAI's DALL-E models:
 * - dall-e-3: Latest and most capable, best quality
 * - dall-e-2: Faster and more cost-effective
 *
 * Features:
 * - Native 16:9 support (1792x1024) with DALL-E 3
 * - Quality control (standard or hd) with DALL-E 3
 * - Style control (vivid or natural) with DALL-E 3
 */

// Model options
export const MODELS = {
  DALLE3: 'dall-e-3',
  DALLE2: 'dall-e-2',
  // Aliases for convenience
  LATEST: 'dall-e-3',
  STANDARD: 'dall-e-3',
  MINI: 'dall-e-2',
};

/**
 * Generate image from text prompt using DALL-E
 * @param {string} prompt - Text description of image to generate
 * @param {object} options - Generation options
 * @param {string} options.model - Model to use: 'dall-e-3' or 'dall-e-2' (default: 'dall-e-3')
 * @param {string} options.quality - 'standard' or 'hd' (DALL-E 3 only, default: 'standard')
 * @param {string} options.style - 'vivid' or 'natural' (DALL-E 3 only, default: 'natural')
 * @returns {Promise<Buffer>} - Image buffer
 */
export async function generateImage(prompt, options = {}) {
  const {
    model = MODELS.STANDARD,
    quality = 'standard',
    style = 'natural'
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured in environment');
  }

  return retryWithBackoff(async () => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      // Build request parameters
      const requestParams = {
        model,
        prompt,
        n: 1,
        size: '1792x1024', // 16:9 aspect ratio
        response_format: 'url'
      };

      // Add DALL-E 3 specific parameters
      if (model === 'dall-e-3') {
        requestParams.quality = quality;
        requestParams.style = style;
      }

      const response = await openai.images.generate(requestParams);

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      // Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      // Parse OpenAI API errors
      if (error.code === 'invalid_api_key' || error.status === 401) {
        throw new Error('OpenAI API key is invalid or authentication failed');
      }
      if (error.code === 'content_policy_violation') {
        throw new Error('Content policy violation: The prompt was rejected by OpenAI safety system');
      }
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }, 3, 1000);
}

/**
 * Tweak/edit image using DALL-E 2 image variation
 * Note: DALL-E 3 doesn't support variations, so we use DALL-E 2
 * Variations create similar images, ignoring the prompt parameter
 * @param {Buffer} sourceImageBuffer - Source image buffer
 * @param {string} prompt - Modification prompt (ignored, kept for API compatibility)
 * @returns {Promise<Buffer>} - Modified image buffer
 */
export async function tweakImage(sourceImageBuffer, prompt) {
  return retryWithBackoff(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured in environment');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      // Use DALL-E 2 for variations (DALL-E 3 doesn't support this)
      const { createReadStream } = await import('fs');
      const { writeFile, unlink } = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempImagePath = path.join(os.tmpdir(), `dalle-source-${Date.now()}.png`);

      try {
        // Write source image to temp file
        await writeFile(tempImagePath, sourceImageBuffer);

        // Create variation - note: prompt is ignored by the API
        const response = await openai.images.createVariation({
          image: createReadStream(tempImagePath),
          n: 1,
          size: '1024x1024', // DALL-E 2 variations only support square sizes
          response_format: 'url'
        });

        const imageUrl = response.data[0].url;
        if (!imageUrl) {
          throw new Error('No image URL returned from OpenAI');
        }

        // Download the modified image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.statusText}`);
        }

        const arrayBuffer = await imageResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } finally {
        // Clean up temp file
        try {
          await unlink(tempImagePath);
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      if (error.code === 'invalid_api_key' || error.status === 401) {
        throw new Error('OpenAI API key is invalid or authentication failed');
      }
      if (error.code === 'content_policy_violation') {
        throw new Error('Content policy violation: The prompt was rejected by OpenAI safety system');
      }
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      throw error;
    }
  }, 3, 1000);
}

export default {
  generateImage,
  tweakImage,
  MODELS
};
