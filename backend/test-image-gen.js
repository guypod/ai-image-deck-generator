#!/usr/bin/env node
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BASE_URL = 'http://localhost:3001';

async function testImageGeneration() {
  console.log('🎨 Testing AI Image Generation\n');

  try {
    // Create a test deck
    console.log('1️⃣  Creating test deck...');
    const createDeckRes = await fetch(`${BASE_URL}/api/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Image Generation Test',
        visualStyle: 'Minimalist, professional, modern design'
      })
    });
    const deck = await createDeckRes.json();
    console.log('   ✅ Deck created:', deck.id);

    // Create a test slide
    console.log('\n2️⃣  Creating test slide...');
    const createSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speakerNotes: 'This is a test slide for image generation',
        imageDescription: 'A beautiful sunset over mountains with clouds'
      })
    });
    const slide = await createSlideRes.json();
    console.log('   ✅ Slide created:', slide.id);

    // Test image generation
    console.log('\n3️⃣  Generating images (this may take 10-30 seconds)...');
    console.log('   ⏳ Please wait...');

    const generateRes = await fetch(
      `${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 2,
          service: 'gemini-pro' // Use Gemini Pro by default
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

    // Get the updated slide to verify images were saved
    console.log('\n4️⃣  Verifying images were saved...');
    const getSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}`);
    const updatedSlide = await getSlideRes.json();
    console.log('   ✅ Slide has', updatedSlide.generatedImages.length, 'image(s)');

    updatedSlide.generatedImages.forEach((img, i) => {
      console.log(`      Image ${i + 1}:`, {
        service: img.service,
        pinned: img.isPinned,
        filename: img.filename
      });
    });

    // Cleanup
    console.log('\n5️⃣  Cleaning up...');
    await fetch(`${BASE_URL}/api/decks/${deck.id}`, { method: 'DELETE' });
    console.log('   ✅ Test deck deleted');

    console.log('\n✅ Image generation test passed!\n');
    console.log('🎉 Your AI image generation is working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.message.includes('not configured')) {
      console.error('\n💡 API key not configured. Please:');
      console.error('   1. Start the app: npm run dev');
      console.error('   2. Go to http://localhost:3000');
      console.error('   3. Navigate to Settings');
      console.error('   4. Configure your API keys in backend/.env file (GEMINI_API_KEY or OPENAI_API_KEY)');
      console.error('   5. Run this test again');
    } else if (error.message.includes('quota')) {
      console.error('\n💡 API quota exceeded. Check your Google Cloud console.');
    } else if (error.message.includes('auth')) {
      console.error('\n💡 Authentication failed. Check your credentials in .env');
    }

    process.exit(1);
  }
}

// Check if server is running
console.log('Checking if server is running...');
fetch(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    testImageGeneration();
  })
  .catch(() => {
    console.error('❌ Server is not running!');
    console.error('\n💡 Start the server first:');
    console.error('   npm run dev');
    process.exit(1);
  });
