/**
 * Parse text block into slides, converting ~name to @name notation
 * Lines with bullets (* or -) default to having images (not scene starts)
 * Lines without bullets are scene starts (text-only, mark scene boundaries)
 * @param {string} text - Multi-line text block
 * @returns {Array<{text: string, noImages: boolean, sceneStart: boolean}>} - Array of slide objects
 */
export function parseTextToSlides(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split by lines
  const lines = text.split('\n');
  const slides = [];

  for (let line of lines) {
    // Trim whitespace
    line = line.trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    // Check if line has a bullet marker (- or *)
    const hasBullet = /^[-*]\s+/.test(line);

    // Remove common bullet markers (-, *, •, numbers like "1.", "1)", etc.)
    line = line.replace(/^[-*•]\s+/, ''); // Remove bullet markers
    line = line.replace(/^\d+[\.)]\s+/, ''); // Remove numbered list markers (1. or 1))

    // Skip if empty after removing bullets
    if (!line) {
      continue;
    }

    // Convert ~name to @name
    line = line.replace(/~([a-zA-Z0-9][a-zA-Z0-9-]*)/g, '@$1');

    // Lines with bullets = content slides (have images, not scene starts)
    // Lines without bullets = scene start slides (no images, scene boundaries)
    slides.push({
      text: line,
      noImages: !hasBullet,
      sceneStart: !hasBullet
    });
  }

  return slides;
}

/**
 * Extract entity names from text (finds all @name references)
 * @param {string} text - Text containing @name references
 * @returns {Array<string>} - Array of unique entity names
 */
export function extractEntityNames(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const matches = text.matchAll(/@([a-zA-Z0-9][a-zA-Z0-9-]*)/g);
  const entities = new Set();

  for (const match of matches) {
    entities.add(match[1]);
  }

  return Array.from(entities);
}
