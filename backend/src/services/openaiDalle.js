import OpenAI from 'openai';
import { retryWithBackoff } from '../utils/asyncPool.js';
import * as fileSystem from './fileSystem.js';

/**
 * Get OpenAI client
 */
async function getOpenAIClient() {
  const settings = await fileSystem.getSettings();
  const apiKey = settings.apiKeys?.openaiDalle || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set it in Settings.');
  }

  return new OpenAI({ apiKey });
}

/**
 * Generate image from text prompt using DALL-E
 * @param {string} prompt - Text description of image to generate
 * @returns {Promise<Buffer>} - Image buffer
 */
export async function generateImage(prompt) {
  return retryWithBackoff(async () => {
    const openai = await getOpenAIClient();

    try {
      // Use DALL-E 3 with 1792x1024 (closest to 16:9)
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1792x1024', // Closest to 16:9 aspect ratio
        quality: 'hd',
        response_format: 'url'
      });

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI DALL-E');
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
      if (error.code === 'invalid_api_key') {
        throw new Error('OpenAI API key is invalid');
      }
      if (error.code === 'content_policy_violation') {
        throw new Error('Content policy violation: The prompt was rejected by OpenAI safety system');
      }
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      if (error.status === 401) {
        throw new Error('OpenAI API authentication failed. Check your API key.');
      }
      throw error;
    }
  }, 3, 1000);
}

/**
 * Tweak/edit image using DALL-E 2 (DALL-E 3 doesn't support editing)
 * @param {Buffer} sourceImageBuffer - Source image buffer
 * @param {string} prompt - Modification prompt
 * @returns {Promise<Buffer>} - Modified image buffer
 */
export async function tweakImage(sourceImageBuffer, prompt) {
  return retryWithBackoff(async () => {
    const openai = await getOpenAIClient();

    try {
      // DALL-E 2 supports editing, but limited to 1024x1024
      // We'll need to create a temporary file for the API
      const { createReadStream } = await import('fs');
      const { writeFile, unlink } = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const tempImagePath = path.join(os.tmpdir(), `dalle-source-${Date.now()}.png`);

      try {
        // Write source image to temp file
        await writeFile(tempImagePath, sourceImageBuffer);

        // Use DALL-E 2 for editing
        const response = await openai.images.edit({
          model: 'dall-e-2',
          image: createReadStream(tempImagePath),
          prompt: prompt,
          n: 1,
          size: '1024x1024', // DALL-E 2 limitation
          response_format: 'url'
        });

        const imageUrl = response.data[0].url;
        if (!imageUrl) {
          throw new Error('No image URL returned from OpenAI DALL-E');
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
      if (error.code === 'invalid_api_key') {
        throw new Error('OpenAI API key is invalid');
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
 * Test if OpenAI API key is valid
 * @param {string} apiKey - API key to test
 * @returns {Promise<{valid: boolean, message: string}>}
 */
export async function testOpenAIKey(apiKey) {
  try {
    const openai = new OpenAI({ apiKey });

    // Try to list models (lightweight operation)
    await openai.models.list();

    return {
      valid: true,
      message: 'OpenAI API key is valid'
    };
  } catch (error) {
    if (error.status === 401) {
      return {
        valid: false,
        message: 'Invalid API key'
      };
    }
    return {
      valid: false,
      message: error.message || 'API key test failed'
    };
  }
}

export default {
  generateImage,
  tweakImage,
  testOpenAIKey
};
