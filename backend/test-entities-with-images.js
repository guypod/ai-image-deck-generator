#!/usr/bin/env node
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import FormData from 'form-data';
import path from 'path';

dotenv.config();

const BASE_URL = 'http://localhost:3001';

async function testEntitiesWithImages() {
  console.log('🎨 Testing Entity Reference Images with Gemini\n');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    console.error('Please add GEMINI_API_KEY to backend/.env file');
    process.exit(1);
  }

  try {
    // 1. Create a test deck
    console.log('1️⃣  Creating test deck...');
    const createDeckRes = await fetch(`${BASE_URL}/api/decks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Entity Test Deck',
        visualStyle: 'Professional photography, high quality'
      })
    });

    const deck = await createDeckRes.json();
    console.log('   ✅ Deck created:', deck.id);

    // 2. Generate a simple test entity image (red square) for testing
    console.log('\n2️⃣  Creating test entity images...');

    // Create a simple test image using OpenAI first
    console.log('   Generating reference image with OpenAI (a golden retriever dog)...');
    const { generateImage, MODELS } = await import('./src/services/openaiGptImage.js');
    const dogImageBuffer = await generateImage('A golden retriever dog, professional portrait photo, white background', {
      model: MODELS.STANDARD
    });
    console.log('   ✅ Dog image generated:', dogImageBuffer.length, 'bytes');

    // 3. Upload entity image
    console.log('\n3️⃣  Uploading entity image...');
    const formData = new FormData();
    formData.append('entityName', 'Golden-Retriever');
    formData.append('image', dogImageBuffer, 'dog.png');

    const uploadRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/entities`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json();
      throw new Error(`Failed to upload entity: ${errorData.error}`);
    }

    const updatedDeck = await uploadRes.json();
    console.log('   ✅ Entity created with image');
    console.log('   Entity:', updatedDeck.entities['Golden-Retriever']);

    // 4. Create a slide with entity reference
    console.log('\n4️⃣  Creating slide with entity reference...');
    const createSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speakerNotes: 'This is about @Golden-Retriever playing in the park',
        imageDescription: '@Golden-Retriever running through a meadow with flowers, sunny day'
      })
    });

    const slide = await createSlideRes.json();
    console.log('   ✅ Slide created:', slide.id);
    console.log('   ℹ️  Description:', slide.imageDescription);

    // 5. Generate images with Gemini (which supports reference images)
    console.log('\n5️⃣  Generating images with Gemini Pro (with entity reference)...');
    console.log('   Service: gemini-pro');
    console.log('   Entity reference: @Golden-Retriever');
    console.log('   ⏳ This will use the uploaded dog image as reference...');
    console.log('   ⏳ Please wait (20-40 seconds)...\n');

    const generateRes = await fetch(
      `${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: 2,
          service: 'gemini-pro'
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

    // 6. Verify images
    console.log('\n6️⃣  Verifying generated images...');
    const getSlideRes = await fetch(`${BASE_URL}/api/decks/${deck.id}/slides/${slide.id}`);
    const updatedSlide = await getSlideRes.json();
    console.log('   ✅ Slide has', updatedSlide.generatedImages.length, 'image(s)');

    updatedSlide.generatedImages.forEach((img, i) => {
      console.log(`      Image ${i + 1}:`, {
        service: img.service,
        filename: img.filename,
        created: new Date(img.createdAt).toLocaleString()
      });
      console.log(`      👉 View at: http://localhost:3001/api/decks/${deck.id}/slides/${slide.id}/images/${img.id}`);
    });

    // 7. Instructions
    console.log('\n📝 MANUAL VERIFICATION NEEDED:');
    console.log('   Please open the generated images in a browser and verify:');
    console.log('   1. The images show a golden retriever dog (similar to the reference)');
    console.log('   2. The dog is in a meadow with flowers (as described)');
    console.log('   3. The generated images should resemble the reference dog image\n');

    console.log('   Image URLs:');
    updatedSlide.generatedImages.forEach((img, i) => {
      console.log(`   ${i + 1}. http://localhost:3001/api/decks/${deck.id}/slides/${slide.id}/images/${img.id}`);
    });

    console.log('\n   Reference entity image:');
    const entityImageFilename = updatedDeck.entities['Golden-Retriever'].images[0];
    console.log(`   http://localhost:3001/api/decks/${deck.id}/entities/Golden-Retriever/${entityImageFilename}`);

    // Keep the deck for manual inspection
    console.log('\n✅ Test completed successfully!');
    console.log('📌 Deck preserved for inspection. Delete manually when done:');
    console.log(`   Deck ID: ${deck.id}`);
    console.log(`   DELETE: curl -X DELETE ${BASE_URL}/api/decks/${deck.id}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Check if server is running
console.log('Checking if server is running...');
fetch(`${BASE_URL}/api/decks`)
  .then(() => {
    console.log('✅ Server is running\n');
    testEntitiesWithImages();
  })
  .catch(() => {
    console.error('❌ Server is not running!');
    console.error('\n💡 Start the server first: npm run dev');
    process.exit(1);
  });
