#!/usr/bin/env node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BASE_URL = 'http://localhost:3001';

async function testEndToEnd() {
  console.log('🎨 Testing OpenAI Image Generation End-to-End\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('Please add OPENAI_API_KEY to backend/.env file');
    process.exit(1);
  }

  try {
    // Create a test deck
    console.log('1️⃣  Creating test deck...');
    const createDeckRes = await fetch(`${BASE_URL}/api/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'OpenAI Test Deck',
        visualStyle: 'Professional, modern, high-quality photography'
      })
    });

    if (!createDeckRes.ok) {
      throw new Error(`Failed to create deck: ${await createDeckRes.text()}`);
    }

    const deck = await createDeckRes.json();
    console.log('   ✅ Deck created:', deck.id);

    // Add entities to the deck
    console.log('\n2️⃣  Adding entities to deck...');
    const updateDeckRes = await fetch(`${BASE_URL}/api/decks/${deck.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visualStyle: 'Professional, modern, high-quality photography',
        entities: {
          'Golden-Gate-Bridge': {
            name: 'Golden-Gate-Bridge',
            images: []
          },
          'San-Francisco': {
            name: 'San-Francisco',
            images: []
          }
        }
      })
    });

    if (!updateDeckRes.ok) {
      throw new Error(`Failed to update deck: ${await updateDeckRes.text()}`);
    }

    console.log('   ✅ Entities added: Golden-Gate-Bridge, San-Francisco');

    // Create a test slide with entity references
    console.log('\n3️⃣  Creating test slide with entity references...');
    const createSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speakerNotes: 'Welcome to @San-Francisco, home of the iconic @Golden-Gate-Bridge',
        imageDescription: 'Wide shot of @Golden-Gate-Bridge in @San-Francisco at sunset with vibrant colors'
      })
    });

    if (!createSlideRes.ok) {
      throw new Error(`Failed to create slide: ${await createSlideRes.text()}`);
    }

    const slide = await createSlideRes.json();
    console.log('   ✅ Slide created:', slide.id);
    console.log('   ℹ️  Entity references: @Golden-Gate-Bridge, @San-Francisco');

    // Test image generation with OpenAI
    console.log('\n4️⃣  Generating images with OpenAI DALL-E 3...');
    console.log('   Service: openai-gpt-image');
    console.log('   Count: 2 images');
    console.log('   ⏳ Please wait (this may take 20-40 seconds)...');

    const generateRes = await fetch(
      `${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 2,
          service: 'openai-gpt-image'
        })
      }
    );

    if (!generateRes.ok) {
      const error = await generateRes.json();
      throw new Error(error.error || 'Image generation failed');
    }

    const result = await generateRes.json();
    console.log('   ✅ Images generated:', result.images.length);

    if (result.failed && result.failed.length > 0) {
      console.log('   ⚠️  Some generations failed:', result.failed);
    }

    // Verify images were saved
    console.log('\n5️⃣  Verifying images were saved...');
    const getSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}`);
    const updatedSlide = await getSlideRes.json();
    console.log('   ✅ Slide has', updatedSlide.generatedImages.length, 'image(s)');

    updatedSlide.generatedImages.forEach((img, i) => {
      console.log(`      Image ${i + 1}:`, {
        service: img.service,
        pinned: img.isPinned,
        filename: img.filename,
        created: new Date(img.createdAt).toLocaleString()
      });
    });

    // Cleanup
    console.log('\n6️⃣  Cleaning up...');
    await fetch(`${BASE_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
    console.log('   ✅ Test deck deleted');

    console.log('\n✅ End-to-end test passed!');
    console.log('🎉 OpenAI image generation is working correctly through the full application!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);

    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Server is not running. Start it with: npm run dev');
    } else if (error.message.includes('not configured')) {
      console.error('\n💡 API key not configured. Check backend/.env file');
    }

    process.exit(1);
  }
}

// Check if server is running
console.log('Checking if server is running...');
fetch(`${BASE_URL}/api/decks`)
  .then(() => {
    console.log('✅ Server is running\n');
    testEndToEnd();
  })
  .catch(() => {
    console.error('❌ Server is not running!');
    console.error('\n💡 Start the server first:');
    console.error('   cd /Users/guypod/proj/ai-image-deck-generator-');
    console.error('   npm run dev');
    process.exit(1);
  });
