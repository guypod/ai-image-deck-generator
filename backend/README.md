# AI Image Deck Generator - Backend

Node.js/Express API for the AI Image Deck Generator application.

## Features

- ✅ Complete REST API for deck and slide management
- ✅ Google Imagen integration for AI image generation
- ✅ OpenAI DALL-E integration for AI image generation
- ✅ Image-to-image tweaking support
- ✅ Bulk image generation with progress tracking
- ✅ File-based persistence with atomic writes
- ✅ Entity reference parsing (@EntityName)
- ✅ 16:9 aspect ratio enforcement
- ✅ Parallel image generation with rate limiting

## Prerequisites

- Node.js >= 18.0.0
- Google Cloud Project with Vertex AI API enabled (for Imagen)
- OpenAI API key (for DALL-E) - optional
- Google OAuth credentials (for Slides export) - optional

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `GOOGLE_PROJECT_ID` - Your Google Cloud project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key JSON
- `OPENAI_API_KEY` - OpenAI API key (optional, can be set in app)

3. **Start the server:**
```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on http://localhost:3001

## Testing

### Basic API Test
```bash
# Start server in another terminal first
npm run dev

# Then run tests
npm run test:api
```

This tests:
- Health check endpoint
- Settings management
- Deck CRUD operations
- Slide CRUD operations
- Basic functionality

### Image Generation Test
```bash
# Make sure server is running
npm run test:image-gen
```

This tests:
- Creating deck and slide
- Generating AI images
- Verifying image persistence
- Testing with Google Imagen

**Note:** This will use your API credits (small amount).

## API Endpoints

### Health
- `GET /health` - Server health check

### Decks
- `GET /api/decks` - List all decks
- `GET /api/decks/:deckId` - Get deck details
- `POST /api/decks` - Create new deck
- `PUT /api/decks/:deckId` - Update deck
- `DELETE /api/decks/:deckId` - Delete deck

### Entities
- `POST /api/decks/:deckId/entities` - Add entity with image
- `DELETE /api/decks/:deckId/entities/:entityName` - Remove entity
- `GET /api/decks/:deckId/entities/:entityName/:filename` - Get entity image

### Slides
- `GET /api/decks/:deckId/slides` - List slides
- `GET /api/decks/:deckId/slides/:slideId` - Get slide
- `POST /api/decks/:deckId/slides` - Create slide
- `PUT /api/decks/:deckId/slides/:slideId` - Update slide
- `DELETE /api/decks/:deckId/slides/:slideId` - Delete slide
- `POST /api/decks/:deckId/slides/reorder` - Reorder slides

### Images
- `POST /api/decks/:deckId/slides/:slideId/generate` - Generate images
- `POST /api/decks/:deckId/slides/:slideId/tweak` - Tweak existing image
- `PUT /api/decks/:deckId/slides/:slideId/images/:imageId/pin` - Pin image
- `DELETE /api/decks/:deckId/slides/:slideId/images/:imageId` - Delete image
- `GET /api/decks/:deckId/slides/:slideId/images/:imageId` - Get image file

### Bulk Operations
- `POST /api/decks/:deckId/generate-all` - Generate all slides
- `POST /api/decks/:deckId/generate-missing` - Generate missing slides
- `GET /api/jobs/:jobId` - Check job status

### Settings
- `GET /api/settings` - Get settings (masked)
- `PUT /api/settings` - Update settings
- `POST /api/settings/test-api-key` - Test API key

## Project Structure

```
backend/
├── src/
│   ├── routes/           # API route handlers
│   │   ├── decks.js      # Deck endpoints
│   │   ├── slides.js     # Slide endpoints
│   │   ├── images.js     # Image generation endpoints
│   │   └── settings.js   # Settings endpoints
│   ├── services/         # Business logic
│   │   ├── fileSystem.js      # File operations
│   │   ├── googleImagen.js    # Google Imagen API
│   │   ├── openaiDalle.js     # OpenAI DALL-E API
│   │   └── imageProcessor.js  # Image processing (16:9, etc.)
│   ├── models/           # Data validation
│   │   ├── Deck.js       # Deck schema
│   │   ├── Slide.js      # Slide schema
│   │   └── Settings.js   # Settings schema
│   ├── utils/            # Utilities
│   │   ├── promptParser.js    # @entity reference parsing
│   │   └── asyncPool.js       # Parallel execution
│   ├── middleware/       # Express middleware
│   │   ├── errorHandler.js    # Error handling
│   │   └── validation.js      # Request validation
│   ├── app.js            # Express app setup
│   └── server.js         # Server entry point
├── test-api.js           # API integration tests
├── test-image-gen.js     # Image generation tests
└── package.json
```

## Development

### Adding New Routes

1. Create route file in `src/routes/`
2. Import in `src/app.js`
3. Add route with `app.use()`

### Adding New AI Service

1. Create service file in `src/services/`
2. Implement `generateImage()` and `tweakImage()` functions
3. Add to `src/routes/images.js` service selection

### Error Handling

All routes use `asyncHandler` wrapper to catch errors automatically. Errors are processed by the global error handler middleware.

Common error patterns:
- 400: Validation errors
- 401: Authentication errors
- 404: Resource not found
- 409: Conflict (duplicate)
- 500: Internal server error

## Storage

Data is stored in `~/.ai-image-decks/`:

```
~/.ai-image-decks/
├── settings.json
└── deck-{uuid}/
    ├── deck.json
    ├── entities/
    │   └── *.jpg
    └── slide-{id}/
        ├── slide.json
        └── image-*.jpg
```

## Troubleshooting

### "Unable to infer your project"
- Check `GOOGLE_PROJECT_ID` in `.env`
- Verify project ID matches Google Cloud Console

### "Could not load credentials"
- Check `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Verify file exists and is valid JSON
- Ensure service account has "Vertex AI User" role

### "API key not configured"
- Set API keys in Settings via the web UI
- Or set `OPENAI_API_KEY` in `.env` for testing

### "Permission denied"
- Service account needs "Vertex AI User" role
- Check IAM permissions in Google Cloud Console

### Rate limit errors
- Reduce `MAX_CONCURRENT_GENERATIONS` in `.env`
- Default is 5, try 2-3 for lower rate limits

## Performance

- **Concurrency**: Controlled by `MAX_CONCURRENT_GENERATIONS` (default: 5)
- **Image processing**: Sharp library for fast image manipulation
- **Atomic writes**: Prevents data corruption
- **In-memory job tracking**: Jobs expire after 1 hour

## Security

- API keys stored with 600 permissions
- Masked in API responses
- File paths validated to prevent traversal
- Entity names sanitized
- CORS enabled for frontend

## Next Steps

1. ✅ Backend API complete
2. 🔄 Build React frontend
3. 🔄 Implement Google Slides export
4. 🔄 Add comprehensive test suite
5. 🔄 Deploy to production

## License

MIT
