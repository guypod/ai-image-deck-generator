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
  DialogContentText,
  DialogActions,
  Snackbar,
} from '@mui/material';
import { ArrowBack, PhotoCamera, Delete, PushPin, Edit as EditIcon, Lock, LockOpen, Close, ChevronLeft, ChevronRight, History } from '@mui/icons-material';
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
  // Always fetch from API to ensure we have fresh data
  const { slide: slideFromHook, updateSlide, pinImage, deleteImage, refresh } = useSlide(deckId, slideId);
  const { generating, generateImages, tweakImage } = useImages(deckId, slideId);
  const { createSlide } = useSlides(deckId);

  // Always use hook data to ensure fresh API data
  const slide = slideFromHook;

  const [speakerNotes, setSpeakerNotes] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [overrideVisualStyle, setOverrideVisualStyle] = useState('');
  const [noImages, setNoImages] = useState(false);
  const [descriptionLocked, setDescriptionLocked] = useState(false);
  const [sceneStart, setSceneStart] = useState(false);
  const [sceneVisualStyle, setSceneVisualStyle] = useState('');
  const [variantCount, setVariantCount] = useState(2);
  const [service, setService] = useState('gemini-pro');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [lastUsedPrompt, setLastUsedPrompt] = useState('');
  const [tweakDialogOpen, setTweakDialogOpen] = useState(false);
  const [tweakImageId, setTweakImageId] = useState(null);
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [tweakCount, setTweakCount] = useState(2);
  const [viewImageId, setViewImageId] = useState(null);
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [generatingCount, setGeneratingCount] = useState(0); // Track number of images being generated
  const [descriptionHistory, setDescriptionHistory] = useState([]); // History of past descriptions
  const [historyIndex, setHistoryIndex] = useState(null); // null = current, 0+ = viewing history item

  // Store current state in refs so we can access it during navigation
  const currentStateRef = React.useRef({
    speakerNotes: '',
    imageDescription: '',
    overrideVisualStyle: '',
    noImages: false,
    descriptionLocked: false,
    sceneStart: false,
    sceneVisualStyle: '',
    unsavedChanges: false
  });

  // Update ref whenever state changes
  React.useEffect(() => {
    currentStateRef.current = {
      speakerNotes,
      imageDescription,
      overrideVisualStyle,
      noImages,
      descriptionLocked,
      sceneStart,
      sceneVisualStyle,
      unsavedChanges
    };
  }, [speakerNotes, imageDescription, overrideVisualStyle, noImages, descriptionLocked, sceneStart, sceneVisualStyle, unsavedChanges]);

  // Load slide data when slide changes OR slideId changes
  useEffect(() => {
    if (slide) {
      setSpeakerNotes(slide.speakerNotes);
      setImageDescription(slide.imageDescription);
      setOverrideVisualStyle(slide.overrideVisualStyle || '');
      setNoImages(slide.noImages || false);
      setDescriptionLocked(slide.descriptionLocked || false);
      setSceneStart(slide.sceneStart || false);
      setSceneVisualStyle(slide.sceneVisualStyle || '');
      setDescriptionHistory(slide.descriptionHistory || []);
      setHistoryIndex(null); // Reset to showing current description
      setUnsavedChanges(false);
    }
  }, [slide, slideId]); // Added slideId as dependency

  // Track if we need to refresh on mount due to save from previous slide
  const needsRefreshRef = React.useRef(false);

  // Save immediately when slideId is about to change
  React.useEffect(() => {
    return () => {
      // On unmount/cleanup, save if there are unsaved changes
      const state = currentStateRef.current;
      if (state.unsavedChanges && slideId) {
        needsRefreshRef.current = true;
        // Use slideAPI directly to ensure it works even after component updates
        slideAPI.update(deckId, slideId, {
          speakerNotes: state.speakerNotes,
          imageDescription: state.imageDescription,
          overrideVisualStyle: state.overrideVisualStyle || null,
          noImages: state.noImages,
          descriptionLocked: state.descriptionLocked,
          sceneStart: state.sceneStart,
          sceneVisualStyle: state.sceneVisualStyle || null
        }).catch(err => {
          console.error('Failed to save on navigation:', err);
        });
      }
    };
  }, [slideId, deckId]);

  // Force refresh when component mounts if previous navigation triggered a save
  React.useEffect(() => {
    if (needsRefreshRef.current && refresh) {
      setTimeout(() => {
        refresh();
        needsRefreshRef.current = false;
      }, 500);
    }
  }, [slideId, refresh]);

  // Manual save function for blur events
  const handleBlurSave = async () => {
    if (unsavedChanges) {
      try {
        await updateSlide({
          speakerNotes,
          imageDescription,
          overrideVisualStyle: overrideVisualStyle || null,
          noImages,
          descriptionLocked,
          sceneStart,
          sceneVisualStyle: sceneVisualStyle || null
        });
        setUnsavedChanges(false);
      } catch (err) {
        console.error('Save on blur failed:', err);
      }
    }
  };

  const handleSave = async () => {
    try {
      await updateSlide({
        speakerNotes,
        imageDescription,
        overrideVisualStyle: overrideVisualStyle || null,
        noImages,
        descriptionLocked,
        sceneStart,
        sceneVisualStyle: sceneVisualStyle || null
      });
      setUnsavedChanges(false);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleToggleLock = () => {
    setDescriptionLocked(!descriptionLocked);
    setUnsavedChanges(true);
  };

  // History navigation - total items = history + current
  const totalHistoryItems = descriptionHistory.length + 1;
  const currentHistoryPosition = historyIndex === null ? totalHistoryItems : historyIndex + 1;
  const isViewingHistory = historyIndex !== null;
  const displayedDescription = isViewingHistory ? descriptionHistory[historyIndex] : imageDescription;

  const handleHistoryPrev = () => {
    if (historyIndex === null) {
      // Currently showing current, go to last history item
      if (descriptionHistory.length > 0) {
        setHistoryIndex(descriptionHistory.length - 1);
      }
    } else if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleHistoryNext = () => {
    if (historyIndex !== null) {
      if (historyIndex < descriptionHistory.length - 1) {
        setHistoryIndex(historyIndex + 1);
      } else {
        // At the end of history, go back to current
        setHistoryIndex(null);
      }
    }
  };

  const handleRestoreFromHistory = () => {
    if (historyIndex !== null && descriptionHistory[historyIndex]) {
      setImageDescription(descriptionHistory[historyIndex]);
      setHistoryIndex(null);
      setUnsavedChanges(true);
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    try {
      // First, save the current description to history if it exists
      const currentDesc = imageDescription.trim();
      if (currentDesc) {
        await updateSlide({
          pushDescriptionToHistory: true,
          imageDescription: currentDesc // Keep current while pushing to history
        });
      }

      const response = await fetch(
        `http://localhost:3001/api/decks/${deckId}/slides/${slideId}/generate-description`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate description');
      }

      const data = await response.json();
      const newDescription = data.description;

      // Save the new description to the backend
      await updateSlide({ imageDescription: newDescription });

      // Now refresh to get updated slide data including history
      await refresh();

      // Update local state after refresh
      setImageDescription(newDescription);
      setHistoryIndex(null); // Reset to showing current
      setUnsavedChanges(false); // Already saved

      return newDescription;
    } catch (err) {
      setSnackbar({ open: true, message: `Error generating description: ${err.message}`, severity: 'error' });
      throw err;
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleGenerate = async () => {
    let finalDescription = imageDescription;

    // Show placeholder cards immediately
    setGeneratingCount(variantCount);

    try {
      // Auto-generate description if empty
      if (!imageDescription.trim()) {
        finalDescription = await handleGenerateDescription();
        // Save the generated description
        await updateSlide({ speakerNotes, imageDescription: finalDescription });
        await refresh();
        if (isEmbedded && onSlideChange) onSlideChange();
      } else if (unsavedChanges) {
        await handleSave();
      }

      const result = await generateImages(variantCount, service);
      // Store the prompt that was used
      if (result.prompt) {
        setLastUsedPrompt(result.prompt);
      }
      await refresh();
      if (isEmbedded && onSlideChange) onSlideChange();
    } catch (err) {
      setSnackbar({ open: true, message: `Error generating images: ${err.message}`, severity: 'error' });
    } finally {
      setGeneratingCount(0); // Hide placeholder cards
    }
  };

  const handlePinImage = async (imageId) => {
    try {
      await pinImage(imageId);
      if (isEmbedded && onSlideChange) onSlideChange();
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleDeleteImageClick = (imageId) => {
    setImageToDelete(imageId);
    setDeleteImageDialogOpen(true);
  };

  const handleDeleteImageConfirm = async () => {
    if (!imageToDelete) return;

    try {
      await deleteImage(imageToDelete);
      if (isEmbedded && onSlideChange) onSlideChange();
      setSnackbar({ open: true, message: 'Image deleted successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setDeleteImageDialogOpen(false);
      setImageToDelete(null);
    }
  };

  const handleDeleteImageCancel = () => {
    setDeleteImageDialogOpen(false);
    setImageToDelete(null);
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
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
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
      setSnackbar({ open: true, message: 'Please enter a tweak prompt', severity: 'warning' });
      return;
    }

    try {
      setGeneratingCount(tweakCount); // Show placeholder cards
      handleCloseTweakDialog();
      await tweakImage(tweakImageId, tweakPrompt, tweakCount);
      await refresh();
      if (isEmbedded && onSlideChange) onSlideChange();
    } catch (err) {
      setSnackbar({ open: true, message: `Error tweaking image: ${err.message}`, severity: 'error' });
    } finally {
      setGeneratingCount(0); // Hide placeholder cards
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
              key={`speaker-notes-${slideId}`}
              fullWidth
              label="Speaker Notes"
              multiline
              rows={4}
              value={speakerNotes}
              onChange={(e) => {
                setSpeakerNotes(e.target.value);
                setUnsavedChanges(true);
              }}
              onBlur={handleBlurSave}
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
                {/* History navigation */}
                {descriptionHistory.length > 0 && (
                  <Box display="flex" alignItems="center" gap={0.5} ml={1}>
                    <IconButton
                      size="small"
                      onClick={handleHistoryPrev}
                      disabled={historyIndex === 0}
                      title="Previous description"
                    >
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                    <Chip
                      icon={<History fontSize="small" />}
                      label={`${currentHistoryPosition}/${totalHistoryItems}`}
                      size="small"
                      color={isViewingHistory ? 'info' : 'default'}
                      variant={isViewingHistory ? 'filled' : 'outlined'}
                    />
                    <IconButton
                      size="small"
                      onClick={handleHistoryNext}
                      disabled={historyIndex === null}
                      title="Next description"
                    >
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
              {isViewingHistory && (
                <Alert severity="info" sx={{ mb: 1 }} action={
                  <Button color="inherit" size="small" onClick={handleRestoreFromHistory}>
                    Restore
                  </Button>
                }>
                  Viewing historical description {historyIndex + 1} of {descriptionHistory.length}
                </Alert>
              )}
              <TextField
                fullWidth
                multiline
                rows={4}
                value={displayedDescription}
                onChange={(e) => {
                  if (!isViewingHistory) {
                    setImageDescription(e.target.value);
                    setUnsavedChanges(true);
                  }
                }}
                onBlur={handleBlurSave}
                placeholder="Describe the image to generate... (or leave empty to auto-generate)"
                helperText="Use @EntityName to reference named entities"
                disabled={isViewingHistory}
                sx={isViewingHistory ? { bgcolor: 'action.hover' } : {}}
              />
              <Button
                size="small"
                onClick={handleGenerateDescription}
                disabled={generatingDescription || isViewingHistory}
                sx={{ mt: 1 }}
              >
                {generatingDescription ? 'Generating...' : 'Generate Description with ChatGPT'}
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Service</InputLabel>
                <Select
                  value={service}
                  label="Service"
                  onChange={(e) => setService(e.target.value)}
                >
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

            <Divider sx={{ my: 3 }} />

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
              onBlur={handleBlurSave}
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
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mb: sceneStart ? 2 : 0 }}>
                Mark this slide as a scene boundary. Description generation will only use context from slides after this point. Scene starts are always without images.
              </Typography>

              {/* Scene Visual Style - only shown when sceneStart is true */}
              {sceneStart && (
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Scene Visual Style"
                  value={sceneVisualStyle}
                  onChange={(e) => {
                    setSceneVisualStyle(e.target.value);
                    setUnsavedChanges(true);
                  }}
                  onBlur={handleBlurSave}
                  placeholder="Visual style for this scene (applies to all slides until the next scene start)..."
                  helperText="This visual style will be used for all slides in this scene, unless overridden by individual slides"
                  sx={{ mt: 1 }}
                />
              )}
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
          </Paper>
        </Grid>

        {/* Right Column - Images */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" gutterBottom>
            Generated Images ({slide.generatedImages.length})
            {generatingCount > 0 && (
              <Chip
                label={`Generating ${generatingCount}...`}
                size="small"
                color="primary"
                sx={{ ml: 1, verticalAlign: 'middle' }}
              />
            )}
          </Typography>

          {slide.generatedImages.length === 0 && generatingCount === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No images generated yet
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {/* Placeholder cards for images being generated */}
              {generatingCount > 0 && Array.from({ length: generatingCount }).map((_, index) => (
                <Grid item xs={12} key={`generating-${index}`}>
                  <Card sx={{ position: 'relative' }}>
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.100',
                        gap: 2,
                      }}
                    >
                      <CircularProgress size={48} />
                      <Typography variant="body2" color="text.secondary">
                        Generating image {index + 1} of {generatingCount}...
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}

              {/* Existing generated images */}
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
                      onClick={() => setViewImageId(image.id)}
                      sx={{ objectFit: 'contain', bgcolor: 'grey.100', cursor: 'pointer' }}
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
                        onClick={() => handleDeleteImageClick(image.id)}
                        title="Delete image"
                      >
                        <Delete />
                      </IconButton>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {image.service === 'gemini-flash' ? 'Gemini Flash' :
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

      {/* Image Viewer Dialog */}
      <Dialog
        open={viewImageId !== null}
        onClose={() => setViewImageId(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography variant="h6">Image Preview</Typography>
          <IconButton
            onClick={() => setViewImageId(null)}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: 'grey.900' }}>
          {viewImageId && (
            <img
              src={slideAPI.getImage(deckId, slideId, viewImageId)}
              alt="Full size preview"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Image Confirmation Dialog */}
      <Dialog
        open={deleteImageDialogOpen}
        onClose={handleDeleteImageCancel}
      >
        <DialogTitle>Delete Image?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this image? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteImageCancel}>Cancel</Button>
          <Button onClick={handleDeleteImageConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
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
