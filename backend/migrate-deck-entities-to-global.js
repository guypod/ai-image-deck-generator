#!/usr/bin/env node

/**
 * Migration script to move entities from a specific deck to global entities
 * Usage: node migrate-deck-entities-to-global.js <deckId>
 */

import * as fileSystem from './src/services/fileSystem.js';
import fs from 'fs/promises';
import path from 'path';

async function migrateDeckEntitiesToGlobal(deckId) {
  console.log(`\nMigrating entities from deck ${deckId} to global entities...\n`);

  try {
    // Get the deck
    const deck = await fileSystem.getDeck(deckId);
    console.log(`Found deck: ${deck.name}`);
    console.log(`Entities in deck: ${Object.keys(deck.entities).length}`);

    if (Object.keys(deck.entities).length === 0) {
      console.log('No entities to migrate.');
      return;
    }

    // Get current global entities
    const globalEntities = await fileSystem.getGlobalEntities();
    console.log(`Current global entities: ${Object.keys(globalEntities).length}`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    // Migrate each entity
    for (const [entityName, entityData] of Object.entries(deck.entities)) {
      console.log(`\nProcessing entity: ${entityName}`);

      // Check if entity already exists globally
      if (globalEntities[entityName]) {
        console.log(`  ⚠️  Entity '${entityName}' already exists globally, skipping`);
        skipped++;
        continue;
      }

      try {
        // Get the entity image paths
        const deckEntityDir = fileSystem.getEntityImagePath(deckId, '').replace(/\/$/, '');

        // Copy each image to global entities
        for (const imageFilename of entityData.images) {
          const sourcePath = path.join(deckEntityDir, imageFilename);
          console.log(`  📁 Reading image: ${imageFilename}`);

          try {
            const imageBuffer = await fs.readFile(sourcePath);

            // Add to global entities
            console.log(`  ✅ Adding to global entities...`);
            await fileSystem.addGlobalEntity(entityName, imageBuffer, 'jpg');

            migrated++;
            console.log(`  ✅ Successfully migrated: ${entityName}`);
          } catch (error) {
            console.error(`  ❌ Failed to read image ${imageFilename}:`, error.message);
            failed++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Failed to migrate entity ${entityName}:`, error.message);
        failed++;
      }
    }

    // Remove entities from deck
    console.log(`\n📝 Updating deck to remove migrated entities...`);
    deck.entities = {};
    deck.updatedAt = new Date().toISOString();

    const deckPath = path.join(
      process.env.STORAGE_PATH || path.join(process.env.HOME || process.env.USERPROFILE, '.ai-image-decks'),
      `deck-${deckId}`,
      'deck.json'
    );

    // Write updated deck
    await fs.writeFile(deckPath, JSON.stringify(deck, null, 2), 'utf8');

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Migrated: ${migrated}`);
    console.log(`   - Skipped (already global): ${skipped}`);
    console.log(`   - Failed: ${failed}`);

    // Verify
    const updatedGlobalEntities = await fileSystem.getGlobalEntities();
    console.log(`\nTotal global entities now: ${Object.keys(updatedGlobalEntities).length}`);
    console.log(`Global entities: ${Object.keys(updatedGlobalEntities).join(', ')}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Get deck ID from command line
const deckId = process.argv[2];

if (!deckId) {
  console.error('Usage: node migrate-deck-entities-to-global.js <deckId>');
  process.exit(1);
}

// Run migration
migrateDeckEntitiesToGlobal(deckId)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
