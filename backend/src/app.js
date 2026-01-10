import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import decksRouter from './routes/decks.js';
import slidesRouter from './routes/slides.js';
import settingsRouter from './routes/settings.js';
import imagesRouter from './routes/images.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/decks', decksRouter);
app.use('/api/decks/:deckId/slides', slidesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api', imagesRouter);

// Export routes (will be added later)
// app.use('/api', exportRouter);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
