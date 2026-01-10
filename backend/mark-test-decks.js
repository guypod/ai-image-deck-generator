/**
 * Script to mark existing test decks as isTest=true
 *
 * Identifies test decks by name patterns:
 * - Starts with "Test"
 * - Contains "Test -"
 * - Contains "(test)"
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function markTestDecks() {
  console.log('=== Marking Test Decks ===\n');

  try {
    // Get all decks including test ones
    console.log('Fetching all decks (including test)...');
    const response = await fetch(`${BASE_URL}/api/decks?includeTest=true`);

    if (!response.ok) {
      throw new Error(`Failed to fetch decks: ${response.statusText}`);
    }

    const decks = await response.json();
    console.log(`Found ${decks.length} total decks\n`);

    // Patterns to identify test decks
    const testPatterns = [
      /^Test\s/i,              // Starts with "Test "
      /Test\s+-\s+/i,          // Contains "Test - "
      /\(test\)/i,             // Contains "(test)"
      /^Test$/i,               // Exactly "Test"
      /Test\s+Deck/i,          // Contains "Test Deck"
      /Entity\s+Test/i,        // Contains "Entity Test"
      /OpenAI\s+Test/i,        // Contains "OpenAI Test"
    ];

    let markedCount = 0;
    let alreadyMarkedCount = 0;

    for (const deck of decks) {
      const isTestName = testPatterns.some(pattern => pattern.test(deck.name));

      if (isTestName) {
        if (deck.isTest) {
          console.log(`✓ Already marked: ${deck.name}`);
          alreadyMarkedCount++;
        } else {
          console.log(`→ Marking as test: ${deck.name}`);

          const updateResponse = await fetch(`${BASE_URL}/api/decks/${deck.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isTest: true })
          });

          if (!updateResponse.ok) {
            const error = await updateResponse.json();
            console.log(`  ✗ Failed: ${error.error}`);
          } else {
            console.log(`  ✓ Marked successfully`);
            markedCount++;
          }
        }
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Newly marked: ${markedCount}`);
    console.log(`Already marked: ${alreadyMarkedCount}`);
    console.log(`Total test decks: ${markedCount + alreadyMarkedCount}`);

    // Show remaining non-test decks
    const remainingResponse = await fetch(`${BASE_URL}/api/decks`);
    const remainingDecks = await remainingResponse.json();
    console.log(`\nRemaining visible decks: ${remainingDecks.length}`);
    if (remainingDecks.length > 0) {
      console.log('\nVisible decks:');
      remainingDecks.forEach(deck => {
        console.log(`  - ${deck.name}`);
      });
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

markTestDecks();
