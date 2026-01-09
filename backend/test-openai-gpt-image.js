#!/usr/bin/env node
import dotenv from 'dotenv';
import { generateImage, MODELS } from './src/services/openaiGptImage.js';
import { writeFile } from 'fs/promises';
import path from 'path';

dotenv.config();

async function testOpenAIGPTImage() {
  console.log('🎨 Testing OpenAI GPT Image Generation\n');

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.error('Please add OPENAI_API_KEY to backend/.env file');
    process.exit(1);
  }

  console.log('✅ OPENAI_API_KEY found');
  console.log('API Key:', process.env.OPENAI_API_KEY.substring(0, 10) + '...\n');

  try {
    console.log('1️⃣  Testing with DALL-E 3 (STANDARD model)...');
    console.log('   Prompt: "A beautiful sunset over mountains"');
    console.log('   ⏳ Generating (this may take 10-30 seconds)...\n');

    const imageBuffer = await generateImage('A beautiful sunset over mountains with vibrant colors, 16:9 aspect ratio, professional photography', {
      model: MODELS.STANDARD,
      quality: 'standard',
      style: 'natural'
    });

    console.log('   ✅ Image generated successfully!');
    console.log('   Buffer size:', imageBuffer.length, 'bytes');

    // Save image to test output
    const outputPath = path.join(process.cwd(), 'test-output-openai.png');
    await writeFile(outputPath, imageBuffer);
    console.log('   💾 Saved to:', outputPath);

    console.log('\n✅ All tests passed!');
    console.log('🎉 OpenAI DALL-E 3 image generation is working correctly!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);

    if (error.message.includes('invalid_api_key') || error.message.includes('authentication')) {
      console.error('\n💡 API key is invalid. Please check:');
      console.error('   1. Key is correct in backend/.env');
      console.error('   2. Key has not expired');
      console.error('   3. Key is for the correct OpenAI account');
    } else if (error.message.includes('model_not_found') || error.message.includes('does not exist')) {
      console.error('\n💡 Model not found.');
      console.error('   OpenAI currently supports: dall-e-3, dall-e-2');
    } else if (error.message.includes('rate_limit')) {
      console.error('\n💡 Rate limit exceeded. Wait a moment and try again.');
    }

    process.exit(1);
  }
}

testOpenAIGPTImage();
