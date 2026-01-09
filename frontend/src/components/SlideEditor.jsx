import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Chip,
} from '@mui/material';
import { ArrowBack, PhotoCamera, Delete, PushPin, Edit as EditIcon } from '@mui/icons-material';
import { useSlide, useSlides } from '../hooks/useSlides';
import { useDeck } from '../hooks/useDecks';
import { useImages } from '../hooks/useImages';
import { slideAPI } from '../services/api';

export default function SlideEditor() {
  const { deckId, slideId } = useParams();
  const navigate = useNavigate();
  const { deck } = useDeck(deckId);
  const { slide, updateSlide, pinImage, deleteImage, refresh } = useSlide(deckId, slideId);
  const { generating, generateImages, tweakImage } = useImages(deckId, slideId);
  const { createSlide } = useSlides(deckId);

  const [speakerNotes, setSpeakerNotes] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [variantCount, setVariantCount] = useState(2);
  const [service, setService] = useState('gemini-pro');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    if (slide) {
      setSpeakerNotes(slide.speakerNotes);
      setImageDescription(slide.imageDescription);
      setUnsavedChanges(false);
    }
  }, [slide]);

  const handleSave = async () => {
    try {
      await updateSlide({ speakerNotes, imageDescription });
      setUnsavedChanges(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/decks/${deckId}/slides/${slideId}/generate-description`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate description');
      }

      const data = await response.json();
      setImageDescription(data.description);
      setUnsavedChanges(true);
      return data.description;
    } catch (err) {
      alert(`Error generating description: ${err.message}`);
      throw err;
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleGenerate = async () => {
    let finalDescription = imageDescription;

    // Auto-generate description if empty
    if (!imageDescription.trim()) {
      try {
        finalDescription = await handleGenerateDescription();
        // Save the generated description
        await updateSlide({ speakerNotes, imageDescription: finalDescription });
        await refresh();
      } catch (err) {
        // Error already alerted in handleGenerateDescription
        return;
      }
    } else if (unsavedChanges) {
      await handleSave();
    }

    try {
      await generateImages(variantCount, service);
      await refresh();
    } catch (err) {
      alert(`Error generating images: ${err.message}`);
    }
  };

  const handlePinImage = async (imageId) => {
    try {
      await pinImage(imageId);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Delete this image?')) return;
    try {
      await deleteImage(imageId);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleCreateNextSlide = async () => {
    try {
      if (unsavedChanges) {
        await handleSave();
      }
      const newSlide = await createSlide({
        speakerNotes: '',
        imageDescription: '',
      });
      navigate(`/decks/${deckId}/slides/${newSlide.id}`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  if (!slide || !deck) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  const pinnedImage = slide.generatedImages.find(img => img.isPinned);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(`/decks/${deckId}`)}
        >
          Back to Deck
        </Button>
        <Button
          variant="contained"
          onClick={handleCreateNextSlide}
        >
          Next Slide
        </Button>
      </Box>

      <Typography variant="h4" gutterBottom>
        Slide {slide.order + 1}
      </Typography>

      <Grid container spacing={3}>
        {/* Left Column - Content */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <TextField
              fullWidth
              label="Speaker Notes"
              multiline
              rows={4}
              value={speakerNotes}
              onChange={(e) => {
                setSpeakerNotes(e.target.value);
                setUnsavedChanges(true);
              }}
              placeholder="What you'll say on this slide..."
              sx={{ mb: 3 }}
            />

            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Image Description"
                multiline
                rows={4}
                value={imageDescription}
                onChange={(e) => {
                  setImageDescription(e.target.value);
                  setUnsavedChanges(true);
                }}
                placeholder="Describe the image to generate... (or leave empty to auto-generate)"
                helperText="Use @EntityName to reference named entities"
              />
              <Button
                size="small"
                onClick={handleGenerateDescription}
                disabled={generatingDescription}
                sx={{ mt: 1 }}
              >
                {generatingDescription ? 'Generating...' : 'Generate Description with ChatGPT'}
              </Button>
            </Box>

            {unsavedChanges && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Button onClick={handleSave} size="small">
                  Save Changes
                </Button>
              </Alert>
            )}

            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Service</InputLabel>
                <Select
                  value={service}
                  label="Service"
                  onChange={(e) => setService(e.target.value)}
                >
                  <MenuItem value="openai-gpt-image">OpenAI GPT Image</MenuItem>
                  <MenuItem value="gemini-flash">Gemini Flash</MenuItem>
                  <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Variants</InputLabel>
                <Select
                  value={variantCount}
                  label="Variants"
                  onChange={(e) => setVariantCount(e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={(generating || generatingDescription) ? <CircularProgress size={20} /> : <PhotoCamera />}
              onClick={handleGenerate}
              disabled={generating || generatingDescription}
            >
              {generatingDescription ? 'Creating Description...' :
               generating ? 'Generating Images...' :
               'Generate Images'}
            </Button>

            {!imageDescription.trim() && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Description will be auto-generated using ChatGPT from your speaker notes
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Images */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Generated Images ({slide.generatedImages.length})
          </Typography>

          {slide.generatedImages.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No images generated yet
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {slide.generatedImages.map((image) => (
                <Grid item xs={12} key={image.id}>
                  <Card>
                    {image.isPinned && (
                      <Chip
                        label="Pinned"
                        color="primary"
                        size="small"
                        icon={<PushPin />}
                        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                      />
                    )}
                    <CardMedia
                      component="img"
                      height="200"
                      image={slideAPI.getImage(deckId, slideId, image.id)}
                      alt="Generated"
                      sx={{ objectFit: 'contain', bgcolor: 'grey.100' }}
                    />
                    <CardActions>
                      <IconButton
                        size="small"
                        onClick={() => handlePinImage(image.id)}
                        color={image.isPinned ? 'primary' : 'default'}
                      >
                        <PushPin />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteImage(image.id)}
                      >
                        <Delete />
                      </IconButton>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {image.service === 'openai-gpt-image' ? 'GPT Image' :
                         image.service === 'gemini-flash' ? 'Gemini Flash' :
                         image.service === 'gemini-pro' ? 'Gemini Pro' : image.service}
                      </Typography>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
