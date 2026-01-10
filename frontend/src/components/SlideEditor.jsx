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
  Checkbox,
  FormControlLabel,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { ArrowBack, PhotoCamera, Delete, PushPin, Edit as EditIcon, Lock, LockOpen } from '@mui/icons-material';
import { useSlide, useSlides } from '../hooks/useSlides';
import { useDeck } from '../hooks/useDecks';
import { useImages } from '../hooks/useImages';
import { slideAPI } from '../services/api';

export default function SlideEditor({ slideData, deckId: deckIdProp, slideId: slideIdProp, isEmbedded = false, onSlideChange }) {
  const { deckId: deckIdParam, slideId: slideIdParam } = useParams();
  const navigate = useNavigate();

  // Use props if embedded, otherwise use URL params
  const deckId = isEmbedded ? deckIdProp : deckIdParam;
  const slideId = isEmbedded ? slideIdProp : slideIdParam;

  const { deck } = useDeck(deckId);
  const { slide: slideFromHook, updateSlide, pinImage, deleteImage, refresh } = useSlide(deckId, slideId);
  const { generating, generateImages, tweakImage } = useImages(deckId, slideId);
  const { createSlide } = useSlides(deckId);

  // Use slideData prop if embedded, otherwise use hook data
  const slide = isEmbedded ? slideData : slideFromHook;

  const [speakerNotes, setSpeakerNotes] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [overrideVisualStyle, setOverrideVisualStyle] = useState('');
  const [noImages, setNoImages] = useState(false);
  const [descriptionLocked, setDescriptionLocked] = useState(false);
  const [sceneStart, setSceneStart] = useState(false);
  const [variantCount, setVariantCount] = useState(2);
  const [service, setService] = useState('gemini-pro');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [lastUsedPrompt, setLastUsedPrompt] = useState('');
  const [tweakDialogOpen, setTweakDialogOpen] = useState(false);
  const [tweakImageId, setTweakImageId] = useState(null);
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [tweakCount, setTweakCount] = useState(2);

  useEffect(() => {
    if (slide) {
      setSpeakerNotes(slide.speakerNotes);
      setImageDescription(slide.imageDescription);
      setOverrideVisualStyle(slide.overrideVisualStyle || '');
      setNoImages(slide.noImages || false);
      setDescriptionLocked(slide.descriptionLocked || false);
      setSceneStart(slide.sceneStart || false);
      setUnsavedChanges(false);
    }
  }, [slide]);

  const handleSave = async () => {
    try {
      await updateSlide({
        speakerNotes,
        imageDescription,
        overrideVisualStyle: overrideVisualStyle || null,
        noImages,
        descriptionLocked,
        sceneStart
      });
      setUnsavedChanges(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleLock = () => {
    setDescriptionLocked(!descriptionLocked);
    setUnsavedChanges(true);
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
        if (isEmbedded && onSlideChange) onSlideChange();
      } catch (err) {
        // Error already alerted in handleGenerateDescription
        return;
      }
    } else if (unsavedChanges) {
      await handleSave();
    }

    try {
      const result = await generateImages(variantCount, service);
      // Store the prompt that was used
      if (result.prompt) {
        setLastUsedPrompt(result.prompt);
      }
      await refresh();
      if (isEmbedded && onSlideChange) onSlideChange();
    } catch (err) {
      alert(`Error generating images: ${err.message}`);
    }
  };

  const handlePinImage = async (imageId) => {
    try {
      await pinImage(imageId);
      if (isEmbedded && onSlideChange) onSlideChange();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Delete this image?')) return;
    try {
      await deleteImage(imageId);
      if (isEmbedded && onSlideChange) onSlideChange();
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

  const handleOpenTweakDialog = (imageId) => {
    setTweakImageId(imageId);
    setTweakPrompt('');
    setTweakCount(2);
    setTweakDialogOpen(true);
  };

  const handleCloseTweakDialog = () => {
    setTweakDialogOpen(false);
    setTweakImageId(null);
    setTweakPrompt('');
  };

  const handleSubmitTweak = async () => {
    if (!tweakPrompt.trim()) {
      alert('Please enter a tweak prompt');
      return;
    }

    try {
      await tweakImage(tweakImageId, tweakPrompt, tweakCount);
      await refresh();
      if (isEmbedded && onSlideChange) onSlideChange();
      handleCloseTweakDialog();
    } catch (err) {
      alert(`Error tweaking image: ${err.message}`);
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

  const content = (
    <>
      {!isEmbedded && (
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
      )}

      {isEmbedded && (
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="h5">
            Slide {slide.order + 1}
          </Typography>
        </Box>
      )}

      {!isEmbedded && (
        <Typography variant="h4" gutterBottom>
          Slide {slide.order + 1}
        </Typography>
      )}

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
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Image Description
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleToggleLock}
                  title={descriptionLocked ? 'Unlock description (allow auto-regeneration)' : 'Lock description (prevent auto-regeneration)'}
                  color={descriptionLocked ? 'warning' : 'default'}
                >
                  {descriptionLocked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
                </IconButton>
                {descriptionLocked && (
                  <Chip label="Locked" size="small" color="warning" />
                )}
              </Box>
              <TextField
                fullWidth
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

            <TextField
              fullWidth
              multiline
              rows={2}
              label="Override Visual Style (Optional)"
              value={overrideVisualStyle}
              onChange={(e) => {
                setOverrideVisualStyle(e.target.value);
                setUnsavedChanges(true);
              }}
              placeholder="Leave empty to use deck-wide visual style..."
              helperText="Override the deck-wide visual style for this slide only"
              sx={{ mb: 2 }}
            />

            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={noImages}
                    onChange={(e) => {
                      setNoImages(e.target.checked);
                      // If unchecking noImages, also uncheck sceneStart
                      if (!e.target.checked && sceneStart) {
                        setSceneStart(false);
                      }
                      setUnsavedChanges(true);
                    }}
                  />
                }
                label="No Images (text-only slide)"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                Mark this slide as text-only. Image generation will be disabled.
              </Typography>
            </Box>

            <Box sx={{ mb: 3, p: 2, bgcolor: 'info.50', borderRadius: 1, borderLeft: 3, borderColor: 'info.main' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={sceneStart}
                    onChange={(e) => {
                      setSceneStart(e.target.checked);
                      // Scene starts must always have noImages=true
                      if (e.target.checked) {
                        setNoImages(true);
                      }
                      setUnsavedChanges(true);
                    }}
                  />
                }
                label="Scene Start (resets context)"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                Mark this slide as a scene boundary. Description generation will only use context from slides after this point. Scene starts are always without images.
              </Typography>
            </Box>

            {lastUsedPrompt && (
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Last Used Prompt"
                value={lastUsedPrompt}
                InputProps={{
                  readOnly: true,
                }}
                helperText="This is the actual prompt that was sent to the AI"
                sx={{ mb: 2, bgcolor: 'grey.50' }}
              />
            )}

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
              disabled={generating || generatingDescription || noImages}
            >
              {generatingDescription ? 'Creating Description...' :
               generating ? 'Generating Images...' :
               noImages ? 'Image Generation Disabled' :
               'Generate Images'}
            </Button>

            {!imageDescription.trim() && !noImages && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Description will be auto-generated using ChatGPT from your speaker notes
              </Typography>
            )}

            {noImages && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                This slide is marked as "no images" - image generation is disabled
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
              {[...slide.generatedImages]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map((image) => (
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
                        title="Pin as thumbnail"
                      >
                        <PushPin />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => handleOpenTweakDialog(image.id)}
                        title="Tweak this image"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteImage(image.id)}
                        title="Delete image"
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

      {/* Tweak Image Dialog */}
      <Dialog open={tweakDialogOpen} onClose={handleCloseTweakDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Tweak Image</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe how you want to modify this image. The AI will use the current image as a reference and apply your changes.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Tweak Prompt"
            value={tweakPrompt}
            onChange={(e) => setTweakPrompt(e.target.value)}
            placeholder="e.g., 'make the lighting warmer', 'add more contrast', 'change background to sunset'"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth>
            <InputLabel>Number of Variants</InputLabel>
            <Select
              value={tweakCount}
              label="Number of Variants"
              onChange={(e) => setTweakCount(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTweakDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitTweak}
            variant="contained"
            disabled={generating || !tweakPrompt.trim()}
            startIcon={generating ? <CircularProgress size={20} /> : null}
          >
            {generating ? 'Tweaking...' : 'Generate Tweaked Images'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  // Wrap with Container only if not embedded
  return isEmbedded ? (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      {content}
    </Box>
  ) : (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {content}
    </Container>
  );
}
