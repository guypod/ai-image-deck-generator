/**
 * OpenAI Descriptions Service
 * Uses OpenAI's Chat API to generate optimal image descriptions for slides
 */

import OpenAI from 'openai';
import { extractEntityReferences } from '../utils/promptParser.js';

/**
 * Generate an optimal image description using ChatGPT
 * @param {string} speakerNotes - The speaker notes for the slide
 * @param {string} visualStyle - The deck's visual style
 * @param {object} entities - Available entities from the deck
 * @param {array} themeImages - Array of theme image filenames
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} - Generated image description
 */
export async function generateImageDescription(speakerNotes, visualStyle, entities = {}, themeImages = [], apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  // Extract entity references from speaker notes
  const mentionedEntityNames = extractEntityReferences(speakerNotes || '');

  // Filter entities to only those mentioned in speaker notes
  const mentionedEntities = {};
  for (const entityName of mentionedEntityNames) {
    // Case-insensitive match
    const entityKey = Object.keys(entities).find(key => key.toLowerCase() === entityName.toLowerCase());
    if (entityKey) {
      mentionedEntities[entityKey] = entities[entityKey];
    }
  }

  // Build entity context only for mentioned entities
  const entityContext = Object.keys(mentionedEntities).length > 0
    ? `\n\nEntities mentioned in speaker notes: ${Object.keys(mentionedEntities).map(e => `@${e}`).join(', ')}. Keep these entity references in your description.`
    : '';

  // Build theme images context
  const themeContext = themeImages && themeImages.length > 0
    ? `\n\nNote: This deck has ${themeImages.length} theme image${themeImages.length > 1 ? 's' : ''} that set the visual tone. The generated image should match the style and mood of these reference images.`
    : '';

  // Build the prompt for ChatGPT
  const systemPrompt = `You are an expert at creating visual descriptions for presentation slides.
Your task is to generate a concise, visually-focused image description that will be used to generate an AI image for a slide.

Guidelines:
- Focus on visual elements, composition, and mood
- Be specific but concise (1-3 sentences)
- Consider the presentation's visual style and theme images
- Avoid abstract concepts - focus on concrete visual elements
- Think about what would make an engaging slide image
- Keep any @EntityName references that are in the speaker notes
- Do NOT add entity references that aren't already mentioned`;

  const userPrompt = `Create an image description for a slide with these speaker notes:

"${speakerNotes || 'No speaker notes provided'}"

Visual style for the deck: ${visualStyle || 'Professional presentation style'}${themeContext}${entityContext}

Generate a concise visual description (1-3 sentences) that captures the essence of what should be shown in the slide image:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast and cost-effective
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const description = response.choices[0].message.content.trim();

    if (!description) {
      throw new Error('ChatGPT returned an empty description');
    }

    return description;
  } catch (error) {
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key');
    }
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

export default {
  generateImageDescription
};
