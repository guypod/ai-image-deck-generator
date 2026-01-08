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
import { useSlide } from '../hooks/useSlides';
import { useDeck } from '../hooks/useDecks';
import { useImages } from '../hooks/useImages';
import { slideAPI } from '../services/api';

export default function SlideEditor() {
  const { deckId, slideId } = useParams();
  const navigate = useNavigate();
  const { deck } = useDeck(deckId);
  const { slide, updateSlide, pinImage, deleteImage, refresh } = useSlide(deckId, slideId);
  const { generating, generateImages, tweakImage } = useImages(deckId, slideId);

  const [speakerNotes, setSpeakerNotes] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [variantCount, setVariantCount] = useState(2);
  const [service, setService] = useState('gemini-pro');
  const [unsavedChanges, setUnsavedChanges] = useState(false);

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

  const handleGenerate = async () => {
    if (unsavedChanges) {
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
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(`/decks/${deckId}`)}
        sx={{ mb: 3 }}
      >
        Back to Deck
      </Button>

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
              placeholder="Describe the image to generate..."
              helperText="Use @EntityName to reference named entities"
              sx={{ mb: 3 }}
            />

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
                  <MenuItem value="google-imagen">Google Imagen</MenuItem>
                  <MenuItem value="openai-dalle">OpenAI DALL-E</MenuItem>
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
              startIcon={generating ? <CircularProgress size={20} /> : <PhotoCamera />}
              onClick={handleGenerate}
              disabled={generating || !imageDescription.trim()}
            >
              {generating ? 'Generating...' : 'Generate Images'}
            </Button>
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
                        {image.service === 'google-imagen' ? 'Imagen' :
                         image.service === 'openai-dalle' ? 'DALL-E' :
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
