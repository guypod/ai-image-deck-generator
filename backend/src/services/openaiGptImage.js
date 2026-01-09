import OpenAI from 'openai';
import { retryWithBackoff } from '../utils/asyncPool.js';

/**
 * OpenAI GPT Image Generation Service
 *
 * Uses the new GPT Image models (2025):
 * - gpt-image-1.5: Latest and most capable
 * - gpt-image-1: Good balance of quality and speed
 * - gpt-image-1-mini: Fast and cost-effective
 *
 * Features:
 * - Native 16:9 support (1792x1024)
 * - Transparent backgrounds
 * - Multiple output formats (png, jpeg, webp)
 * - Compression control
 * - Streaming mode (future)
 */

// Model options
export const MODELS = {
  LATEST: 'gpt-image-1.5',
  STANDARD: 'gpt-image-1',
  MINI: 'gpt-image-1-mini',
};

/**
 * Generate image from text prompt using GPT Image
 * @param {string} prompt - Text description of image to generate
 * @param {object} options - Generation options
 * @param {string} options.model - Model to use (default: gpt-image-1)
 * @param {string} options.quality - 'standard' or 'hd' (default: 'standard')
 * @param {string} options.style - 'vivid' or 'natural' (default: 'natural')
 * @param {string} options.background - 'auto', 'opaque', or 'transparent' (default: 'auto')
 * @param {string} options.format - 'png', 'jpeg', or 'webp' (default: 'png')
 * @param {number} options.compression - 0-100 for jpeg/webp (default: 85)
 * @returns {Promise<Buffer>} - Image buffer
 */
export async function generateImage(prompt, options = {}) {
  const {
    model = MODELS.STANDARD,
    quality = 'standard',
    style = 'natural',
    background = 'auto',
    format = 'png',
    compression = 85
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
        quality,
        style,
        response_format: 'url'
      };

      // Add GPT Image specific features if using new models
      if (model.startsWith('gpt-image')) {
        requestParams.background = background;
        requestParams.format = format;

        if (format === 'jpeg' || format === 'webp') {
          requestParams.compression = compression;
        }
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
 * Tweak/edit image using image variation
 * Note: The new GPT Image models may have different editing capabilities
 * @param {Buffer} sourceImageBuffer - Source image buffer
 * @param {string} prompt - Modification prompt
 * @returns {Promise<Buffer>} - Modified image buffer
 */
export async function tweakImage(sourceImageBuffer, prompt) {
  return retryWithBackoff(async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured in environment');
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      // For now, we'll use image variation as editing
      // The new GPT Image API may have better editing in the future
      const { createReadStream } = await import('fs');
      const { writeFile, unlink } = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempImagePath = path.join(os.tmpdir(), `gpt-image-source-${Date.now()}.png`);

      try {
        // Write source image to temp file
        await writeFile(tempImagePath, sourceImageBuffer);

        // Create variation with the new prompt context
        const response = await openai.images.createVariation({
          image: createReadStream(tempImagePath),
          model: MODELS.STANDARD, // Use standard model for variations
          n: 1,
          size: '1792x1024',
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
