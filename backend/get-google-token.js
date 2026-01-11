/**
 * Script to obtain Google OAuth refresh token
 * Run this once to get your refresh token, then add it to .env
 *
 * Usage:
 * 1. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are in your .env
 * 2. Run: node get-google-token.js
 * 3. Open the URL in your browser and authorize
 * 4. Copy the refresh token displayed and add to .env file as GOOGLE_REFRESH_TOKEN
 */

import { google } from 'googleapis';
import express from 'express';
import dotenv from 'dotenv';
import open from 'open';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file'
];

async function startServer() {
  const app = express();
  const port = 3002;
  const redirectUri = `http://localhost:${port}/oauth2callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  // Handle OAuth callback
  app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('<h1>Error: No authorization code received</h1>');
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      // Show success page with token
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google OAuth Success</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #4CAF50; }
            .token-box { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .token { word-break: break-all; font-family: monospace; font-size: 12px; }
            .copy-btn { background: #4CAF50; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 3px; margin-top: 10px; }
            .copy-btn:hover { background: #45a049; }
            .instruction { background: #e3f2fd; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>✓ Authorization Successful!</h1>

          <div class="instruction">
            <strong>Next Steps:</strong>
            <ol>
              <li>Copy the refresh token below</li>
              <li>Add it to your <code>backend/.env</code> file as <code>GOOGLE_REFRESH_TOKEN=...</code></li>
              <li>Restart your backend server</li>
              <li>You can now export decks to Google Slides!</li>
              <li>You can close this window and stop this script (Ctrl+C in terminal)</li>
            </ol>
          </div>

          <div class="token-box">
            <strong>GOOGLE_REFRESH_TOKEN:</strong><br>
            <div class="token" id="refreshToken">${tokens.refresh_token}</div>
            <button class="copy-btn" onclick="copyToken()">Copy to Clipboard</button>
          </div>

          <script>
            function copyToken() {
              const token = document.getElementById('refreshToken').textContent;
              navigator.clipboard.writeText(token).then(() => {
                alert('Refresh token copied to clipboard!');
              });
            }
          </script>
        </body>
        </html>
      `);

      console.log('\n✓ Authorization successful!');
      console.log('\nRefresh token has been displayed in your browser.');
      console.log('Copy it and add to your .env file as GOOGLE_REFRESH_TOKEN');
      console.log('\nPress Ctrl+C to exit this script.\n');

    } catch (error) {
      console.error('Error getting tokens:', error.message);
      res.status(500).send(`<h1>Error</h1><p>${error.message}</p>`);
    }
  });

  // Start server
  const server = app.listen(port, () => {
    console.log('\n=================================================');
    console.log('Google OAuth Token Generator');
    console.log('=================================================\n');
    console.log(`Temporary server started on http://localhost:${port}`);
    console.log('\nOpening authorization URL in your browser...\n');
    console.log('If it doesn\'t open automatically, visit this URL:\n');
    console.log(authUrl);
    console.log('\n=================================================\n');

    // Auto-open browser
    open(authUrl).catch(() => {
      console.log('Could not open browser automatically. Please open the URL manually.');
    });
  });
}

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file');
  process.exit(1);
}

startServer();
