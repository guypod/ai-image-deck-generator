import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Storage directory
const getStorageDir = () => {
  const storageEnv = process.env.STORAGE_PATH;
  if (storageEnv && storageEnv.startsWith('~')) {
    return path.join(os.homedir(), storageEnv.slice(1));
  }
  return storageEnv || path.join(os.homedir(), '.ai-image-decks');
};

const STORAGE_DIR = getStorageDir();

/**
 * Initialize storage directory
 */
export async function initStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 });
    console.log(`Storage directory initialized: ${STORAGE_DIR}`);
  } catch (error) {
    console.error('Failed to initialize storage directory:', error);
    throw error;
  }
}

/**
 * Atomic write to JSON file
 * Writes to temp file first, then renames to prevent corruption
 */
async function writeJsonAtomic(filePath, data) {
  const tempPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Read JSON file
 */
async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

// ===== DECK OPERATIONS =====

/**
 * Get all decks
 */
export async function getAllDecks() {
  await initStorage();
  try {
    const entries = await fs.readdir(STORAGE_DIR, { withFileTypes: true });
    const decks = [];

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('deck-')) {
        try {
          const deckPath = path.join(STORAGE_DIR, entry.name, 'deck.json');
          const deck = await readJson(deckPath);
          decks.push(deck);
        } catch (error) {
          console.error(`Failed to read deck ${entry.name}:`, error.message);
          // Continue with other decks
        }
      }
    }

    // Sort by updatedAt descending
    decks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    return decks;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get deck by ID
 */
export async function getDeck(deckId) {
  const deckPath = path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json');
  try {
    return await readJson(deckPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Deck not found: ${deckId}`);
    }
    throw error;
  }
}

/**
 * Create new deck
 */
export async function createDeck(name, visualStyle = '') {
  await initStorage();

  const deckId = uuidv4();
  const now = new Date().toISOString();

  const deck = {
    id: deckId,
    name,
    createdAt: now,
    updatedAt: now,
    visualStyle,
    entities: {},
    slides: []
  };

  const deckDir = path.join(STORAGE_DIR, `deck-${deckId}`);
  const entitiesDir = path.join(deckDir, 'entities');

  try {
    await fs.mkdir(deckDir, { recursive: true });
    await fs.mkdir(entitiesDir, { recursive: true });
    await writeJsonAtomic(path.join(deckDir, 'deck.json'), deck);
    return deck;
  } catch (error) {
    // Cleanup on failure
    try {
      await fs.rm(deckDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Update deck metadata
 */
export async function updateDeck(deckId, updates) {
  const deck = await getDeck(deckId);

  // Update allowed fields
  if (updates.name !== undefined) deck.name = updates.name;
  if (updates.visualStyle !== undefined) deck.visualStyle = updates.visualStyle;

  deck.updatedAt = new Date().toISOString();

  const deckPath = path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json');
  await writeJsonAtomic(deckPath, deck);

  return deck;
}

/**
 * Delete deck
 */
export async function deleteDeck(deckId) {
  const deckDir = path.join(STORAGE_DIR, `deck-${deckId}`);
  try {
    await fs.rm(deckDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Deck not found: ${deckId}`);
    }
    throw error;
  }
}

// ===== ENTITY OPERATIONS =====

/**
 * Add entity to deck
 */
export async function addEntity(deckId, entityName, imageBuffer, imageExtension = 'jpg') {
  const deck = await getDeck(deckId);

  // Check if entity already exists
  if (deck.entities[entityName]) {
    throw new Error(`Entity '${entityName}' already exists`);
  }

  const imageFilename = `${entityName}.${imageExtension}`;
  const imagePath = path.join(STORAGE_DIR, `deck-${deckId}`, 'entities', imageFilename);

  // Save image
  await fs.writeFile(imagePath, imageBuffer);

  // Update deck
  deck.entities[entityName] = {
    name: entityName,
    images: [imageFilename]
  };
  deck.updatedAt = new Date().toISOString();

  const deckPath = path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json');
  await writeJsonAtomic(deckPath, deck);

  return deck;
}

/**
 * Remove entity from deck
 */
export async function removeEntity(deckId, entityName) {
  const deck = await getDeck(deckId);

  if (!deck.entities[entityName]) {
    throw new Error(`Entity '${entityName}' not found`);
  }

  // Delete entity images
  const entityDir = path.join(STORAGE_DIR, `deck-${deckId}`, 'entities');
  for (const imageFilename of deck.entities[entityName].images) {
    try {
      await fs.unlink(path.join(entityDir, imageFilename));
    } catch (error) {
      console.error(`Failed to delete entity image ${imageFilename}:`, error.message);
    }
  }

  // Update deck
  delete deck.entities[entityName];
  deck.updatedAt = new Date().toISOString();

  const deckPath = path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json');
  await writeJsonAtomic(deckPath, deck);

  return deck;
}

// ===== SLIDE OPERATIONS =====

/**
 * Get all slides for a deck
 */
export async function getSlides(deckId) {
  const deck = await getDeck(deckId);
  const slides = [];

  for (const slideId of deck.slides) {
    try {
      const slide = await getSlide(deckId, slideId);
      slides.push(slide);
    } catch (error) {
      console.error(`Failed to read slide ${slideId}:`, error.message);
    }
  }

  // Sort by order
  slides.sort((a, b) => a.order - b.order);
  return slides;
}

/**
 * Get slide by ID
 */
export async function getSlide(deckId, slideId) {
  const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, 'slide.json');
  try {
    return await readJson(slidePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Slide not found: ${slideId}`);
    }
    throw error;
  }
}

/**
 * Create new slide
 */
export async function createSlide(deckId, speakerNotes = '', imageDescription = '') {
  const deck = await getDeck(deckId);

  // Generate slide ID
  const slideNum = deck.slides.length + 1;
  const slideId = `slide-${String(slideNum).padStart(3, '0')}`;

  const slide = {
    id: slideId,
    order: deck.slides.length,
    speakerNotes,
    imageDescription,
    generatedImages: []
  };

  const slideDir = path.join(STORAGE_DIR, `deck-${deckId}`, slideId);

  try {
    await fs.mkdir(slideDir, { recursive: true });
    await writeJsonAtomic(path.join(slideDir, 'slide.json'), slide);

    // Update deck
    deck.slides.push(slideId);
    deck.updatedAt = new Date().toISOString();
    await writeJsonAtomic(path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json'), deck);

    return slide;
  } catch (error) {
    // Cleanup on failure
    try {
      await fs.rm(slideDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Update slide content
 */
export async function updateSlide(deckId, slideId, updates) {
  const slide = await getSlide(deckId, slideId);

  // Update allowed fields
  if (updates.speakerNotes !== undefined) slide.speakerNotes = updates.speakerNotes;
  if (updates.imageDescription !== undefined) slide.imageDescription = updates.imageDescription;
  if (updates.order !== undefined) slide.order = updates.order;

  const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, 'slide.json');
  await writeJsonAtomic(slidePath, slide);

  // Update deck timestamp
  const deck = await getDeck(deckId);
  deck.updatedAt = new Date().toISOString();
  await writeJsonAtomic(path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json'), deck);

  return slide;
}

/**
 * Delete slide
 */
export async function deleteSlide(deckId, slideId) {
  const deck = await getDeck(deckId);

  // Remove from deck
  const slideIndex = deck.slides.indexOf(slideId);
  if (slideIndex === -1) {
    throw new Error(`Slide not found in deck: ${slideId}`);
  }
  deck.slides.splice(slideIndex, 1);

  // Reorder remaining slides
  for (let i = slideIndex; i < deck.slides.length; i++) {
    const slide = await getSlide(deckId, deck.slides[i]);
    slide.order = i;
    const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, deck.slides[i], 'slide.json');
    await writeJsonAtomic(slidePath, slide);
  }

  // Delete slide directory
  const slideDir = path.join(STORAGE_DIR, `deck-${deckId}`, slideId);
  await fs.rm(slideDir, { recursive: true, force: true });

  // Update deck
  deck.updatedAt = new Date().toISOString();
  await writeJsonAtomic(path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json'), deck);

  return true;
}

/**
 * Reorder slides
 */
export async function reorderSlides(deckId, slideIds) {
  const deck = await getDeck(deckId);

  // Validate all slide IDs
  if (slideIds.length !== deck.slides.length) {
    throw new Error('Slide IDs count mismatch');
  }
  for (const slideId of slideIds) {
    if (!deck.slides.includes(slideId)) {
      throw new Error(`Invalid slide ID: ${slideId}`);
    }
  }

  // Update order in each slide
  for (let i = 0; i < slideIds.length; i++) {
    const slide = await getSlide(deckId, slideIds[i]);
    slide.order = i;
    const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideIds[i], 'slide.json');
    await writeJsonAtomic(slidePath, slide);
  }

  // Update deck
  deck.slides = slideIds;
  deck.updatedAt = new Date().toISOString();
  await writeJsonAtomic(path.join(STORAGE_DIR, `deck-${deckId}`, 'deck.json'), deck);

  return true;
}

// ===== IMAGE OPERATIONS =====

/**
 * Add generated image to slide
 */
export async function addGeneratedImage(deckId, slideId, imageBuffer, metadata) {
  const slide = await getSlide(deckId, slideId);

  const imageId = metadata.id || uuidv4();
  const imageNum = slide.generatedImages.length + 1;
  const imageFilename = `image-${String(imageNum).padStart(3, '0')}.jpg`;
  const imagePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, imageFilename);

  // Save image file
  await fs.writeFile(imagePath, imageBuffer);

  // Auto-pin if first image
  const isPinned = slide.generatedImages.length === 0;

  // Add metadata
  const imageMetadata = {
    id: imageId,
    filename: imageFilename,
    createdAt: new Date().toISOString(),
    service: metadata.service,
    prompt: metadata.prompt,
    sourceImageId: metadata.sourceImageId || null,
    isPinned
  };

  slide.generatedImages.push(imageMetadata);

  const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, 'slide.json');
  await writeJsonAtomic(slidePath, slide);

  return imageMetadata;
}

/**
 * Pin image
 */
export async function pinImage(deckId, slideId, imageId) {
  const slide = await getSlide(deckId, slideId);

  let found = false;
  for (const img of slide.generatedImages) {
    if (img.id === imageId) {
      img.isPinned = true;
      found = true;
    } else {
      img.isPinned = false;
    }
  }

  if (!found) {
    throw new Error(`Image not found: ${imageId}`);
  }

  const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, 'slide.json');
  await writeJsonAtomic(slidePath, slide);

  return slide;
}

/**
 * Delete image
 */
export async function deleteImage(deckId, slideId, imageId) {
  const slide = await getSlide(deckId, slideId);

  const imageIndex = slide.generatedImages.findIndex(img => img.id === imageId);
  if (imageIndex === -1) {
    throw new Error(`Image not found: ${imageId}`);
  }

  const image = slide.generatedImages[imageIndex];
  const wasPinned = image.isPinned;

  // Delete image file
  const imagePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, image.filename);
  try {
    await fs.unlink(imagePath);
  } catch (error) {
    console.error(`Failed to delete image file ${image.filename}:`, error.message);
  }

  // Remove from array
  slide.generatedImages.splice(imageIndex, 1);

  // If deleted image was pinned, auto-pin first remaining
  if (wasPinned && slide.generatedImages.length > 0) {
    slide.generatedImages[0].isPinned = true;
  }

  const slidePath = path.join(STORAGE_DIR, `deck-${deckId}`, slideId, 'slide.json');
  await writeJsonAtomic(slidePath, slide);

  return slide;
}

/**
 * Get image file path
 */
export function getImagePath(deckId, slideId, filename) {
  return path.join(STORAGE_DIR, `deck-${deckId}`, slideId, filename);
}

/**
 * Get entity image file path
 */
export function getEntityImagePath(deckId, filename) {
  return path.join(STORAGE_DIR, `deck-${deckId}`, 'entities', filename);
}

// ===== SETTINGS OPERATIONS =====

/**
 * Get settings
 */
export async function getSettings() {
  await initStorage();
  const settingsPath = path.join(STORAGE_DIR, 'settings.json');

  try {
    return await readJson(settingsPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Return defaults
      return {
        apiKeys: {
          googleImagen: null,
          openaiDalle: null,
          geminiNanoBanana: null
        },
        defaultService: 'gemini-pro',
        defaultVariantCount: 2,
        googleSlides: {
          credentials: null
        }
      };
    }
    throw error;
  }
}

/**
 * Save settings
 */
export async function saveSettings(settings) {
  await initStorage();
  const settingsPath = path.join(STORAGE_DIR, 'settings.json');

  await writeJsonAtomic(settingsPath, settings);

  // Set restrictive permissions for security
  try {
    await fs.chmod(settingsPath, 0o600);
  } catch (error) {
    console.error('Failed to set settings file permissions:', error.message);
  }

  return settings;
}

export default {
  initStorage,
  getAllDecks,
  getDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  addEntity,
  removeEntity,
  getSlides,
  getSlide,
  createSlide,
  updateSlide,
  deleteSlide,
  reorderSlides,
  addGeneratedImage,
  pinImage,
  deleteImage,
  getImagePath,
  getEntityImagePath,
  getSettings,
  saveSettings
};
