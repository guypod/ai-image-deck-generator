import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { ArrowBack, Add, Delete, Edit, ImageNotSupported, Close, CloudUpload, Refresh } from '@mui/icons-material';
import { useDeck } from '../hooks/useDecks';
import { useSlides } from '../hooks/useSlides';
import { slideAPI, exportAPI } from '../services/api';
import EntityManager from './EntityManager';
import ThemeImageManager from './ThemeImageManager';

export default function DeckEditor() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const { deck, loading: deckLoading, updateDeck, refresh } = useDeck(deckId);
  const { slides, loading: slidesLoading, createSlide, updateSlide, deleteSlide } = useSlides(deckId);
  const [editingName, setEditingName] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [name, setName] = useState('');
  const [visualStyle, setVisualStyle] = useState('');
  const [isTest, setIsTest] = useState(false);
  const [regeneratingDescriptions, setRegeneratingDescriptions] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteSlideDialogOpen, setDeleteSlideDialogOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [generateAllDialogOpen, setGenerateAllDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [exportState, setExportState] = useState(null);
  const [exportFromSlide, setExportFromSlide] = useState(0);
  const [exportMode, setExportMode] = useState('new'); // 'new' or 'resume'

  useEffect(() => {
    if (deck) {
      setName(deck.name);
      setVisualStyle(deck.visualStyle);
      setIsTest(deck.isTest || false);
    }
  }, [deck]);

  // Check for existing export state
  useEffect(() => {
    const checkExportState = async () => {
      try {
        const response = await exportAPI.getExportState(deckId);
        if (response.data.hasExportInProgress) {
          setExportState(response.data.state);
        } else {
          setExportState(null);
        }
      } catch (err) {
        console.error('Failed to check export state:', err);
      }
    };

    if (deckId) {
      checkExportState();
    }
  }, [deckId]);

  const handleEntityUpdate = () => {
    refresh();
  };

  const handleSaveName = async () => {
    try {
      await updateDeck({ name });
      setEditingName(false);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleSaveStyle = async () => {
    try {
      await updateDeck({ visualStyle });
      setEditingStyle(false);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleIsTestChange = async (newIsTest) => {
    try {
      await updateDeck({ isTest: newIsTest });
      setIsTest(newIsTest);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleCreateSlide = async () => {
    try {
      const slide = await createSlide({
        speakerNotes: '',
        imageDescription: '',
      });
      navigate(`/decks/${deckId}/slides/${slide.id}`);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleDeleteSlideClick = (slideId) => {
    setSlideToDelete(slideId);
    setDeleteSlideDialogOpen(true);
  };

  const handleDeleteSlideConfirm = async () => {
    if (!slideToDelete) return;

    try {
      await deleteSlide(slideToDelete);
      setSnackbar({ open: true, message: 'Slide deleted successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setDeleteSlideDialogOpen(false);
      setSlideToDelete(null);
    }
  };

  const handleDeleteSlideCancel = () => {
    setDeleteSlideDialogOpen(false);
    setSlideToDelete(null);
  };

  const handleToggleNoImages = async (slideId, currentValue) => {
    try {
      await updateSlide(slideId, { noImages: !currentValue });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  const handleRegenerateDescriptionsClick = () => {
    setRegenerateDialogOpen(true);
  };

  const handleRegenerateDescriptionsConfirm = async () => {
    setRegenerateDialogOpen(false);
    setRegeneratingDescriptions(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/decks/${deckId}/regenerate-descriptions`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to regenerate descriptions');
      }

      const data = await response.json();
      setSnackbar({ open: true, message: `Successfully regenerated ${data.regenerated} description(s). ${data.skipped} locked, ${data.failed} failed.`, severity: 'success' });

      // Refresh slides to show new descriptions
      window.location.reload();
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setRegeneratingDescriptions(false);
    }
  };

  const handleGenerateAllImagesClick = () => {
    setGenerateAllDialogOpen(true);
  };

  const handleGenerateAllImagesConfirm = async () => {
    setGenerateAllDialogOpen(false);
    setGeneratingImages(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/decks/${deckId}/generate-all`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: 2, service: 'gemini-pro' })
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start image generation');
      }

      const data = await response.json();
      setSnackbar({ open: true, message: `Image generation started! Job ID: ${data.jobId}. This will take several minutes.`, severity: 'info' });

      // Optionally navigate to slide view to see progress
      // navigate(`/decks/${deckId}/slides`);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setGeneratingImages(false);
    }
  };

  const handleExportClick = (mode = 'new') => {
    setExportMode(mode);
    if (mode === 'new') {
      setExportFromSlide(0);
    }
    setExportDialogOpen(true);
  };

  const handleExportConfirm = async () => {
    setExportDialogOpen(false);
    setExporting(true);
    try {
      const exportData = {
        title: deck.name,
        resume: exportMode === 'resume',
        fromSlideIndex: exportMode === 'new' ? exportFromSlide : undefined
      };

      const response = await exportAPI.toGoogleSlides(deckId, exportData);

      // Clear export state after successful completion
      setExportState(null);

      // Open the new presentation in a new tab
      window.open(response.data.url, '_blank');

      setSnackbar({
        open: true,
        message: `Successfully exported ${response.data.exportedSlideCount} slides to Google Slides!`,
        severity: 'success'
      });
    } catch (err) {
      // Refresh export state in case it was partially saved
      try {
        const stateResponse = await exportAPI.getExportState(deckId);
        if (stateResponse.data.hasExportInProgress) {
          setExportState(stateResponse.data.state);
        }
      } catch (stateErr) {
        console.error('Failed to refresh export state:', stateErr);
      }

      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCancel = () => {
    setExportDialogOpen(false);
  };

  const handleClearExportState = async () => {
    try {
      await exportAPI.clearExportState(deckId);
      setExportState(null);
      setSnackbar({ open: true, message: 'Export state cleared', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  };

  if (deckLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!deck) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Deck not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
        >
          All Decks
        </Button>
        <Button
          variant="outlined"
          startIcon={<Close />}
          onClick={() => navigate(`/decks/${deckId}/edit`)}
        >
          Close Settings
        </Button>
      </Box>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          {editingName ? (
            <>
              <TextField
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <Button onClick={handleSaveName}>Save</Button>
              <Button onClick={() => setEditingName(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <Typography variant="h4" flexGrow={1}>
                {deck.name}
              </Typography>
              <IconButton onClick={() => setEditingName(true)}>
                <Edit />
              </IconButton>
            </>
          )}
        </Box>

        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Visual Style
          </Typography>
          {editingStyle ? (
            <>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value)}
                placeholder="Describe the visual style for all slides (e.g., 'Modern corporate style with vibrant colors')"
              />
              <Box mt={1}>
                <Button onClick={handleSaveStyle} size="small">
                  Save
                </Button>
                <Button onClick={() => setEditingStyle(false)} size="small">
                  Cancel
                </Button>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'grey.200' },
              }}
              onClick={() => setEditingStyle(true)}
            >
              <Typography variant="body2">
                {visualStyle || 'Click to add visual style description...'}
              </Typography>
            </Box>
          )}
        </Box>

        <Box mb={3}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isTest}
                onChange={(e) => handleIsTestChange(e.target.checked)}
              />
            }
            label="Mark as test deck (hidden from deck list by default)"
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4 }}>
            Test decks are hidden from the main deck list to keep it clean
          </Typography>
        </Box>

        <Box sx={{ my: 3, borderBottom: 1, borderColor: 'divider' }} />

        <Box mb={3}>
          <ThemeImageManager
            deckId={deckId}
            themeImages={deck.themeImages || []}
            onUpdate={handleEntityUpdate}
          />
        </Box>

        <Box sx={{ my: 3, borderBottom: 1, borderColor: 'divider' }} />

        <EntityManager
          deckId={deckId}
          entities={deck.entities || {}}
          onUpdate={handleEntityUpdate}
        />

        <Box sx={{ my: 3, borderBottom: 1, borderColor: 'divider' }} />

        <Typography variant="h6" gutterBottom>
          Bulk Operations
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            onClick={handleRegenerateDescriptionsClick}
            disabled={regeneratingDescriptions}
            startIcon={regeneratingDescriptions ? <CircularProgress size={20} /> : null}
          >
            {regeneratingDescriptions ? 'Regenerating...' : 'Regenerate All Descriptions'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleGenerateAllImagesClick}
            disabled={generatingImages}
            startIcon={generatingImages ? <CircularProgress size={20} /> : null}
          >
            {generatingImages ? 'Generating...' : 'Generate All Images'}
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleExportClick('new')}
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={20} /> : <CloudUpload />}
          >
            {exporting ? 'Exporting...' : 'New Export'}
          </Button>
          {exportState && (
            <Button
              variant="outlined"
              color="success"
              onClick={() => handleExportClick('resume')}
              disabled={exporting}
              startIcon={<Refresh />}
            >
              Continue Export ({exportState.lastProcessedSlide + 1}/{exportState.totalSlides})
            </Button>
          )}
        </Box>
        {exportState && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
            <Typography variant="body2" color="info.contrastText" gutterBottom>
              Export in progress: {exportState.lastProcessedSlide + 1} of {exportState.totalSlides} slides processed
            </Typography>
            <LinearProgress
              variant="determinate"
              value={((exportState.lastProcessedSlide + 1) / exportState.totalSlides) * 100}
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="info.contrastText">
              Presentation: <a href={exportState.presentationUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{exportState.title}</a>
            </Typography>
            <Button
              size="small"
              color="inherit"
              onClick={handleClearExportState}
              sx={{ ml: 2 }}
            >
              Clear
            </Button>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Regenerate descriptions skips locked descriptions. Generate images skips "no images" slides. Export creates a new Google Slides presentation from this deck.</Typography>
      </Paper>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Slides ({slides.length})
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateSlide}
        >
          New Slide
        </Button>
      </Box>

      {slidesLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : slides.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="body1" color="text.secondary" mb={2}>
            No slides yet
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateSlide}
          >
            Create First Slide
          </Button>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {slides.map((slide, index) => (
            <Grid item xs={12} sm={6} md={4} key={slide.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h6">
                      Slide {index + 1}
                    </Typography>
                    {slide.noImages && (
                      <Chip
                        icon={<ImageNotSupported />}
                        label="No Images"
                        size="small"
                        color="default"
                        variant="outlined"
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {slide.speakerNotes || 'No speaker notes'}
                  </Typography>
                  {!slide.noImages && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {slide.generatedImages.length} image(s)
                    </Typography>
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={slide.noImages || false}
                        onChange={() => handleToggleNoImages(slide.id, slide.noImages)}
                        size="small"
                      />
                    }
                    label={<Typography variant="caption">No images</Typography>}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate(`/decks/${deckId}/slides/${slide.id}`)}
                  >
                    Edit
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteSlideClick(slide.id)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Delete Slide Confirmation Dialog */}
      <Dialog
        open={deleteSlideDialogOpen}
        onClose={handleDeleteSlideCancel}
      >
        <DialogTitle>Delete Slide?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this slide? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteSlideCancel}>Cancel</Button>
          <Button onClick={handleDeleteSlideConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regenerate Descriptions Confirmation Dialog */}
      <Dialog
        open={regenerateDialogOpen}
        onClose={() => setRegenerateDialogOpen(false)}
      >
        <DialogTitle>Regenerate Descriptions?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Regenerate all unlocked slide descriptions? This will overwrite existing descriptions that are not locked.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegenerateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRegenerateDescriptionsConfirm} variant="contained">
            Regenerate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate All Images Confirmation Dialog */}
      <Dialog
        open={generateAllDialogOpen}
        onClose={() => setGenerateAllDialogOpen(false)}
      >
        <DialogTitle>Generate All Images?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Generate images for all slides (excluding "no images" slides)? This may take several minutes.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenerateAllDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerateAllImagesConfirm} variant="contained">
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Confirmation Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleExportCancel}
        aria-labelledby="export-dialog-title"
        aria-describedby="export-dialog-description"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="export-dialog-title">
          {exportMode === 'resume' ? 'Continue Export' : 'Export to Google Slides'}
        </DialogTitle>
        <DialogContent>
          {exportMode === 'resume' ? (
            <>
              <DialogContentText id="export-dialog-description" sx={{ mb: 2 }}>
                Continue the previous export from where it left off. This will resume adding slides
                to the existing presentation.
              </DialogContentText>
              {exportState && (
                <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Presentation:</strong> {exportState.title}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Progress:</strong> {exportState.lastProcessedSlide + 1} of {exportState.totalSlides} slides completed
                  </Typography>
                  <Typography variant="body2">
                    <strong>Phase:</strong> {exportState.phase === 'creating_slides' ? 'Creating slides' : 'Processing content'}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <>
              <DialogContentText id="export-dialog-description" sx={{ mb: 2 }}>
                This will create a new presentation in your Google account.
                Slides with images will show the pinned image as a full-slide image. Slides without images
                will show the speaker notes as centered text.
              </DialogContentText>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id="from-slide-label">Start from slide</InputLabel>
                <Select
                  labelId="from-slide-label"
                  value={exportFromSlide}
                  label="Start from slide"
                  onChange={(e) => setExportFromSlide(e.target.value)}
                >
                  <MenuItem value={0}>All slides (from beginning)</MenuItem>
                  {slides.map((slide, index) => (
                    <MenuItem key={slide.id} value={index}>
                      Slide {index + 1} onwards ({slides.length - index} slides)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                Export will include slides {exportFromSlide + 1} to {slides.length} ({slides.length - exportFromSlide} slides total)
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportCancel}>
            Cancel
          </Button>
          <Button onClick={handleExportConfirm} variant="contained" color="success" autoFocus>
            {exportMode === 'resume' ? 'Continue Export' : 'Start Export'}
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
    </Container>
  );
}
