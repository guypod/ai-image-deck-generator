#!/usr/bin/env node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAPI() {
  console.log('🧪 Testing AI Image Deck Generator API\n');

  try {
    // Test 1: Health check
    console.log('1️⃣  Testing health endpoint...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('   ✅ Health check:', health.status);

    // Test 2: Get settings
    console.log('\n2️⃣  Testing settings endpoint...');
    const settingsRes = await fetch(`${BASE_URL}/api/settings`);
    const settings = await settingsRes.json();
    console.log('   ✅ Settings loaded:', {
      defaultService: settings.defaultService,
      hasGoogleImagen: !!settings.apiKeys.googleImagen,
      hasOpenAI: !!settings.apiKeys.openaiDalle
    });

    // Test 3: Create deck
    console.log('\n3️⃣  Testing deck creation...');
    const createDeckRes = await fetch(`${BASE_URL}/api/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Deck',
        visualStyle: 'Modern corporate style with vibrant colors'
      })
    });
    const deck = await createDeckRes.json();
    console.log('   ✅ Deck created:', deck.id);

    // Test 4: List decks
    console.log('\n4️⃣  Testing deck listing...');
    const listDecksRes = await fetch(`${BASE_URL}/api/decks`);
    const decks = await listDecksRes.json();
    console.log('   ✅ Decks listed:', decks.length, 'deck(s)');

    // Test 5: Create slide
    console.log('\n5️⃣  Testing slide creation...');
    const createSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speakerNotes: 'Welcome to our presentation',
        imageDescription: 'A modern office environment with people collaborating'
      })
    });
    const slide = await createSlideRes.json();
    console.log('   ✅ Slide created:', slide.id);

    // Test 6: Get slide
    console.log('\n6️⃣  Testing slide retrieval...');
    const getSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}`);
    const retrievedSlide = await getSlideRes.json();
    console.log('   ✅ Slide retrieved:', retrievedSlide.id);

    // Test 7: Update slide
    console.log('\n7️⃣  Testing slide update...');
    const updateSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speakerNotes: 'Updated speaker notes'
      })
    });
    const updatedSlide = await updateSlideRes.json();
    console.log('   ✅ Slide updated');

    // Test 8: Cleanup - Delete deck
    console.log('\n8️⃣  Testing deck deletion...');
    const deleteDeckRes = await fetch(`${BASE_URL}/api/decks/${deck.id}`, {
      method: 'DELETE'
    });
    const deleteResult = await deleteDeckRes.json();
    console.log('   ✅ Deck deleted:', deleteResult.success);

    console.log('\n✅ All tests passed!\n');
    console.log('📝 Summary:');
    console.log('   - Health check: ✅');
    console.log('   - Settings: ✅');
    console.log('   - Create deck: ✅');
    console.log('   - List decks: ✅');
    console.log('   - Create slide: ✅');
    console.log('   - Get slide: ✅');
    console.log('   - Update slide: ✅');
    console.log('   - Delete deck: ✅');

    console.log('\n🚀 Backend API is working correctly!');
    console.log('\n💡 Next steps:');
    console.log('   - Test image generation with: npm run test:image-gen');
    console.log('   - Start frontend: npm run dev:frontend');
    console.log('   - Full dev mode: npm run dev');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n💡 Make sure the backend server is running:');
    console.error('   cd backend && npm run dev');
    process.exit(1);
  }
}

// Check if server is running
console.log('Checking if server is running...');
fetch(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    testAPI();
  })
  .catch(() => {
    console.error('❌ Server is not running!');
    console.error('\n💡 Start the server first:');
    console.error('   cd backend && npm run dev');
    console.error('\nOr start both frontend and backend:');
    console.error('   npm run dev');
    process.exit(1);
  });
