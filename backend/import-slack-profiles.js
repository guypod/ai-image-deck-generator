/**
 * Import Slack workspace profile images as entities
 *
 * Usage:
 *   node import-slack-profiles.js <slack-token> <deck-id>
 *
 * The Slack token needs the following scopes:
 *   - users:read
 *   - users:read.email (optional, for better filtering)
 *
 * Get a token from: https://api.slack.com/apps -> Your App -> OAuth & Permissions
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3001';
const SLACK_API_URL = 'https://slack.com/api';

async function fetchSlackUsers(token) {
  console.log('Fetching users from Slack...');

  const response = await fetch(`${SLACK_API_URL}/users.list`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Slack API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data.members;
}

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function sanitizeEntityName(name) {
  // Convert to a valid entity name format
  // Remove special characters, replace spaces with hyphens
  return name
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Collapse multiple hyphens
    .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
}

async function uploadEntity(deckId, entityName, imageBuffer) {
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  formData.append('entityName', entityName);
  formData.append('image', imageBuffer, { filename: 'profile.jpg' });

  const response = await fetch(`${BASE_URL}/api/decks/${deckId}/entities`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload entity');
  }

  return response.json();
}

async function importSlackProfiles(slackToken, deckId, options = {}) {
  console.log('=== Importing Slack Profile Images ===\n');

  try {
    // Verify deck exists
    console.log(`Verifying deck ${deckId}...`);
    const deckResponse = await fetch(`${BASE_URL}/api/decks/${deckId}`);
    if (!deckResponse.ok) {
      throw new Error(`Deck not found: ${deckId}`);
    }
    const deck = await deckResponse.json();
    console.log(`✓ Found deck: ${deck.name}\n`);

    // Fetch Slack users
    const users = await fetchSlackUsers(slackToken);
    console.log(`✓ Found ${users.length} total users\n`);

    // Filter users
    const validUsers = users.filter(user => {
      // Skip bots unless explicitly included
      if (user.is_bot && !options.includeBots) {
        return false;
      }

      // Skip deleted users
      if (user.deleted) {
        return false;
      }

      // Skip Slackbot
      if (user.id === 'USLACKBOT') {
        return false;
      }

      // Must have a profile image
      if (!user.profile?.image_512 && !user.profile?.image_192) {
        return false;
      }

      // Must have a display name or real name
      if (!user.profile?.display_name && !user.profile?.real_name) {
        return false;
      }

      return true;
    });

    console.log(`Found ${validUsers.length} valid users to import\n`);

    if (validUsers.length === 0) {
      console.log('No users to import!');
      return;
    }

    // Import users
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const user of validUsers) {
      const displayName = user.profile.display_name || user.profile.real_name || user.name;
      const entityName = sanitizeEntityName(displayName);

      // Choose best quality image available
      const imageUrl = user.profile.image_512 || user.profile.image_192 || user.profile.image_72;

      console.log(`Processing: ${displayName} (${user.name})`);
      console.log(`  Entity name: ${entityName}`);
      console.log(`  Image URL: ${imageUrl}`);

      try {
        // Check if entity already exists
        if (deck.entities && deck.entities[entityName]) {
          console.log(`  ⊘ Skipped (already exists)\n`);
          skipCount++;
          continue;
        }

        // Download profile image
        const imageBuffer = await downloadImage(imageUrl);
        console.log(`  ✓ Downloaded (${Math.round(imageBuffer.length / 1024)}KB)`);

        // Upload as entity
        await uploadEntity(deckId, entityName, imageBuffer);
        console.log(`  ✓ Uploaded as entity\n`);

        successCount++;

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`  ✗ Error: ${error.message}\n`);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Skipped (already exist): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total processed: ${validUsers.length}`);

    // Refresh deck to show entities
    const finalDeckResponse = await fetch(`${BASE_URL}/api/decks/${deckId}`);
    const finalDeck = await finalDeckResponse.json();
    const entityCount = Object.keys(finalDeck.entities || {}).length;
    console.log(`\nDeck now has ${entityCount} total entities`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node import-slack-profiles.js <slack-token> <deck-id> [--include-bots]');
  console.log('');
  console.log('Arguments:');
  console.log('  slack-token    Your Slack API token (starts with xoxb- or xoxp-)');
  console.log('  deck-id        The UUID of the deck to add entities to');
  console.log('  --include-bots Optional: Include bot users');
  console.log('');
  console.log('Example:');
  console.log('  node import-slack-profiles.js xoxb-your-token-here 12345678-1234-1234-1234-123456789012');
  console.log('');
  console.log('To get a Slack token:');
  console.log('  1. Go to https://api.slack.com/apps');
  console.log('  2. Create a new app or select existing');
  console.log('  3. Go to "OAuth & Permissions"');
  console.log('  4. Add the "users:read" scope');
  console.log('  5. Install/Reinstall the app to your workspace');
  console.log('  6. Copy the "Bot User OAuth Token" (starts with xoxb-)');
  process.exit(1);
}

const slackToken = args[0];
const deckId = args[1];
const options = {
  includeBots: args.includes('--include-bots')
};

importSlackProfiles(slackToken, deckId, options);
