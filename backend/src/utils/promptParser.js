/**
 * Prompt Parser Utility
 * Handles parsing of @entity references in text and building full prompts for AI generation
 */

/**
 * Parse and replace @entity references in text
 * @param {string} text - Text containing @entity references
 * @param {object} entities - Entity mapping from deck (entityName -> entity data)
 * @returns {object} - { parsedText: string, unknownEntities: string[] }
 */
export function parseEntityReferences(text, entities = {}) {
  if (!text) {
    return { parsedText: '', unknownEntities: [] };
  }

  const unknownEntities = [];
  let parsedText = text;

  // Find all @EntityName patterns
  // Pattern: @ followed by letters, numbers, and hyphens (but not spaces)
  const entityPattern = /@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]|[a-zA-Z0-9])/g;

  const matches = text.matchAll(entityPattern);

  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "@The-Office"
    const entityName = match[1]; // e.g., "The-Office"

    if (entities[entityName]) {
      // Replace @Entity-Name with "Entity Name" (remove hyphens, normalize)
      const humanReadableName = entityName.replace(/-/g, ' ');
      parsedText = parsedText.replace(fullMatch, humanReadableName);
    } else {
      // Entity not found, keep original but track it
      unknownEntities.push(entityName);
      // Keep the @ reference as-is
    }
  }

  return {
    parsedText,
    unknownEntities: [...new Set(unknownEntities)] // Remove duplicates
  };
}

/**
 * Build full prompt for AI image generation
 * Combines visual style + processed description + theme image guidance + quality notes
 * @param {string} visualStyle - Deck's visual style description
 * @param {string} imageDescription - Slide's image description (may contain @entities)
 * @param {object} entities - Entity mapping from deck
 * @param {array} themeImages - Array of theme image filenames
 * @returns {object} - { prompt: string, unknownEntities: string[] }
 */
export function buildFullPrompt(visualStyle, imageDescription, entities = {}, themeImages = []) {
  // Parse entity references in image description
  const { parsedText, unknownEntities } = parseEntityReferences(imageDescription, entities);

  // Build complete prompt
  const parts = [];

  // Add visual style if present
  if (visualStyle && visualStyle.trim()) {
    parts.push(visualStyle.trim());
  }

  // Add theme image guidance if present
  if (themeImages && themeImages.length > 0) {
    parts.push(`Follow the visual style and tone shown in the provided reference images (${themeImages.length} theme image${themeImages.length > 1 ? 's' : ''} available)`);
  }

  // Add processed image description if present
  if (parsedText && parsedText.trim()) {
    parts.push(parsedText.trim());
  }

  // If both visual style and description are empty, return error indicator
  if (parts.length === 0 || (parts.length === 1 && themeImages.length > 0)) {
    throw new Error('Cannot generate image: both visual style and image description are empty');
  }

  // Add quality/format guidance
  parts.push('16:9 aspect ratio, presentation quality, detailed, professional.');

  // Join with periods
  const prompt = parts.join('. ');

  // Validate prompt length (AI services typically have limits)
  if (prompt.length > 2000) {
    throw new Error(`Prompt too long: ${prompt.length} characters (max 2000). Please shorten the visual style or image description.`);
  }

  if (prompt.length < 1) {
    throw new Error('Prompt too short: must be at least 1 character');
  }

  return {
    prompt,
    unknownEntities
  };
}

/**
 * Extract all @entity references from text
 * Returns array of entity names (without @ prefix)
 * @param {string} text - Text to extract entities from
 * @returns {string[]} - Array of entity names
 */
export function extractEntityReferences(text) {
  if (!text) {
    return [];
  }

  const entityPattern = /@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]|[a-zA-Z0-9])/g;
  const matches = text.matchAll(entityPattern);
  const entities = [];

  for (const match of matches) {
    entities.push(match[1]);
  }

  // Remove duplicates and return
  return [...new Set(entities)];
}

/**
 * Validate entity references in text against available entities
 * Returns list of unknown entity references
 * @param {string} text - Text containing potential @entity references
 * @param {object} entities - Available entities from deck
 * @returns {string[]} - Array of unknown entity names
 */
export function validateEntityReferences(text, entities = {}) {
  const referencedEntities = extractEntityReferences(text);
  const unknownEntities = [];

  for (const entityName of referencedEntities) {
    if (!entities[entityName]) {
      unknownEntities.push(entityName);
    }
  }

  return unknownEntities;
}

/**
 * Suggest entity names based on partial input (for autocomplete)
 * @param {string} partial - Partial entity name (without @)
 * @param {object} entities - Available entities from deck
 * @returns {Array<{name: string, displayName: string}>} - Matching entities
 */
export function suggestEntities(partial, entities = {}) {
  if (!partial) {
    // Return all entities if no partial input
    return Object.keys(entities).map(name => ({
      name,
      displayName: name.replace(/-/g, ' ')
    }));
  }

  const partialLower = partial.toLowerCase();
  const suggestions = [];

  for (const entityName of Object.keys(entities)) {
    if (entityName.toLowerCase().includes(partialLower)) {
      suggestions.push({
        name: entityName,
        displayName: entityName.replace(/-/g, ' ')
      });
    }
  }

  // Sort by relevance (exact match first, then starts-with, then contains)
  suggestions.sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();

    // Exact match
    if (aLower === partialLower) return -1;
    if (bLower === partialLower) return 1;

    // Starts with
    const aStarts = aLower.startsWith(partialLower);
    const bStarts = bLower.startsWith(partialLower);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    // Alphabetical
    return aLower.localeCompare(bLower);
  });

  return suggestions;
}

/**
 * Get entity image paths from referenced entities
 * @param {string} text - Text containing @entity references
 * @param {object} entities - Entity mapping from deck
 * @param {string} deckId - Deck ID for building file paths
 * @returns {Array<{entityName: string, imagePath: string}>} - Array of entity image info
 */
export function getReferencedEntityImages(text, entities = {}, deckId) {
  const referencedEntities = extractEntityReferences(text);
  const entityImages = [];

  for (const entityName of referencedEntities) {
    if (entities[entityName] && entities[entityName].images.length > 0) {
      // Use the first image for each entity
      const imageFilename = entities[entityName].images[0];
      entityImages.push({
        entityName,
        imageFilename,
        displayName: entityName.replace(/-/g, ' ')
      });
    }
  }

  return entityImages;
}

export default {
  parseEntityReferences,
  buildFullPrompt,
  extractEntityReferences,
  validateEntityReferences,
  suggestEntities,
  getReferencedEntityImages
};
