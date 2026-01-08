/**
 * Debug script to see exact API request/response
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

console.log('🔍 Testing Gemini API with minimal request\n');
console.log('API Key:', apiKey.substring(0, 10) + '...');

const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

const requestBody = {
  contents: [{
    parts: [
      { text: 'A simple red circle on white background' }
    ]
  }],
  generationConfig: {
    responseModalities: ['IMAGE']
  }
};

console.log('\n📤 Request URL:', url);
console.log('\n📤 Request Body:', JSON.stringify(requestBody, null, 2));

try {
  const response = await axios.post(url, requestBody, {
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  console.log('\n✅ Success!');
  console.log('Response status:', response.status);
  console.log('Response candidates:', response.data.candidates?.length || 0);
  console.log('\nFull response structure:');
  console.log(JSON.stringify(response.data, (key, val) => {
    if (key === 'data' && typeof val === 'string' && val.length > 100) {
      return val.substring(0, 50) + '...[truncated ' + val.length + ' chars]';
    }
    return val;
  }, 2));

  if (response.data.candidates?.[0]?.content?.parts) {
    const parts = response.data.candidates[0].content.parts;
    console.log('\nParts found:', parts.length);

    const imagePart = parts.find(p => p.inlineData || p.inline_data);
    if (imagePart) {
      const imageData = imagePart.inlineData || imagePart.inline_data;
      console.log('✅ Image data received');
      console.log('✅ Image size:', Buffer.from(imageData.data, 'base64').length, 'bytes');

      // Save to file
      const fs = await import('fs/promises');
      await fs.writeFile('test-output.png', Buffer.from(imageData.data, 'base64'));
      console.log('✅ Image saved to test-output.png');
    } else {
      console.log('⚠️  No image data found in parts');
    }
  }
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Response:', JSON.stringify(error.response.data, null, 2));
  }
}
