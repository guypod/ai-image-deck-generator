import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  TextField,
} from '@mui/material';
import { ArrowBack, Settings as SettingsIcon, CloudUpload as ExportIcon } from '@mui/icons-material';
import { useDeck } from '../hooks/useDecks';
import { useSlides } from '../hooks/useSlides';
import { slideAPI, deckAPI } from '../services/api';
import SlidePanel from './SlidePanel';
import SlideEditor from './SlideEditor';

export default function SlideDeckView() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { deck, loading: deckLoading, error: deckError } = useDeck(deckId);
  const { slides: slidesFromHook, loading: slidesLoading, createSlide, updateSlide, deleteSlide, reorderSlides, refresh: refreshSlides } = useSlides(deckId);

  const [slides, setSlides] = useState([]);
  const [selectedSlideId, setSelectedSlideId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTitle, setExportTitle] = useState('');
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Sync local slides with hook slides
  useEffect(() => {
    setSlides(slidesFromHook);
  }, [slidesFromHook]);

  // Auto-select first slide or slide from URL
  useEffect(() => {
    if (slides.length === 0) {
      setSelectedSlideId(null);
      return;
    }

    const slideIdFromUrl = searchParams.get('slide');

    if (slideIdFromUrl && slides.find(s => s.id === slideIdFromUrl)) {
      // URL has valid slide ID, use it
      setSelectedSlideId(slideIdFromUrl);
    } else if (!selectedSlideId || !slides.find(s => s.id === selectedSlideId)) {
      // No selection or invalid selection, select first slide
      setSelectedSlideId(slides[0].id);
      setSearchParams({ slide: slides[0].id });
    }
  }, [slides, searchParams, selectedSlideId, setSearchParams]);

  // Update URL when slide selected
  const handleSelectSlide = (slideId) => {
    setSelectedSlideId(slideId);
    setSearchParams({ slide: slideId });
  };

  // Add new slide
  const handleAddSlide = async () => {
    try {
      const newSlide = await createSlide({
        speakerNotes: '',
        imageDescription: '',
      });
      setSelectedSlideId(newSlide.id);
      setSearchParams({ slide: newSlide.id });
    } catch (error) {
      setSnackbar({ open: true, message: `Error creating slide: ${error.message}`, severity: 'error' });
    }
  };

  // Add slide before selected slide
  const handleAddSlideBefore = async (referenceSlideId) => {
    try {
      // Create new slide (will be added at end)
      const newSlide = await createSlide({
        speakerNotes: '',
        imageDescription: '',
      });

      // Get current slide order
      const slideIds = slides.map(s => s.id);

      // Find position of reference slide
      const refIndex = slideIds.indexOf(referenceSlideId);

      if (refIndex === -1) {
        throw new Error('Reference slide not found');
      }

      // Insert new slide before reference slide
      slideIds.splice(refIndex, 0, newSlide.id);

      // Reorder slides
      await reorderSlides(slideIds);

      // Select new slide
      setSelectedSlideId(newSlide.id);
      setSearchParams({ slide: newSlide.id });
    } catch (error) {
      setSnackbar({ open: true, message: `Error creating slide: ${error.message}`, severity: 'error' });
    }
  };

  // Add slide after selected slide
  const handleAddSlideAfter = async (referenceSlideId) => {
    try {
      // Create new slide (will be added at end)
      const newSlide = await createSlide({
        speakerNotes: '',
        imageDescription: '',
      });

      // Get current slide order
      const slideIds = slides.map(s => s.id);

      // Find position of reference slide
      const refIndex = slideIds.indexOf(referenceSlideId);

      if (refIndex === -1) {
        throw new Error('Reference slide not found');
      }

      // Insert new slide after reference slide
      slideIds.splice(refIndex + 1, 0, newSlide.id);

      // Reorder slides
      await reorderSlides(slideIds);

      // Select new slide
      setSelectedSlideId(newSlide.id);
      setSearchParams({ slide: newSlide.id });
    } catch (error) {
      setSnackbar({ open: true, message: `Error creating slide: ${error.message}`, severity: 'error' });
    }
  };

  // Delete slide with confirmation
  const handleDeleteSlide = (slideId) => {
    setSlideToDelete(slideId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!slideToDelete) return;

    try {
      // Find index of slide being deleted
      const slideIndex = slides.findIndex(s => s.id === slideToDelete);

      await deleteSlide(slideToDelete);

      setDeleteConfirmOpen(false);
      setSlideToDelete(null);

      // Select adjacent slide
      if (slides.length > 1) {
        // Select next slide if available, otherwise previous
        const nextSlide = slides[slideIndex + 1] || slides[slideIndex - 1];
        if (nextSlide && nextSlide.id !== slideToDelete) {
          setSelectedSlideId(nextSlide.id);
          setSearchParams({ slide: nextSlide.id });
        }
      } else {
        // No slides left
        setSelectedSlideId(null);
        setSearchParams({});
      }
    } catch (error) {
      setSnackbar({ open: true, message: `Error deleting slide: ${error.message}`, severity: 'error' });
      setDeleteConfirmOpen(false);
      setSlideToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirmOpen(false);
    setSlideToDelete(null);
  };

  // Reorder slides
  const handleReorderSlides = async (newSlideIds) => {
    try {
      await reorderSlides(newSlideIds);
    } catch (error) {
      setSnackbar({ open: true, message: `Error reordering slides: ${error.message}`, severity: 'error' });
      // The useSlides hook will refresh and show the old order
    }
  };

  // Toggle no images for a slide (inline update without full refresh)
  const handleToggleNoImages = async (slideId, currentValue) => {
    // Optimistically update local state immediately for smooth UX
    setSlides(prevSlides =>
      prevSlides.map(slide =>
        slide.id === slideId
          ? { ...slide, noImages: !currentValue }
          : slide
      )
    );

    try {
      // Update via API in background
      await slideAPI.update(deckId, slideId, { noImages: !currentValue });
    } catch (error) {
      // Revert on error
      setSlides(prevSlides =>
        prevSlides.map(slide =>
          slide.id === slideId
            ? { ...slide, noImages: currentValue }
            : slide
        )
      );
      setSnackbar({ open: true, message: `Error updating slide: ${error.message}`, severity: 'error' });
    }
  };

  // Export single slide
  const handleExportSlide = () => {
    if (!selectedSlideId) return;
    const selectedSlide = slides.find(s => s.id === selectedSlideId);
    const slideNumber = selectedSlide ? selectedSlide.order + 1 : 1;
    setExportTitle(`${deck?.name || 'Slide'} - Slide ${slideNumber}`);
    setExportDialogOpen(true);
  };

  const handleExportConfirm = async () => {
    if (!selectedSlideId) return;

    setExporting(true);
    try {
      const response = await deckAPI.exportSlide(deckId, selectedSlideId, { title: exportTitle });
      setExportDialogOpen(false);
      setExportTitle('');
      setSnackbar({
        open: true,
        message: 'Slide exported successfully! Opening in new tab...',
        severity: 'success'
      });

      // Open the Google Slides presentation in a new tab
      window.open(response.data.url, '_blank');
    } catch (error) {
      setSnackbar({ open: true, message: `Export failed: ${error.message}`, severity: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCancel = () => {
    setExportDialogOpen(false);
    setExportTitle('');
  };

  if (deckLoading || slidesLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (deckError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Failed to load deck: {deckError}</Alert>
      </Container>
    );
  }

  if (!deck) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Deck not found</Alert>
      </Container>
    );
  }

  const selectedSlide = slides.find(s => s.id === selectedSlideId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/')}
          size="small"
        >
          Back
        </Button>

        <Typography variant="h6" flexGrow={1}>
          {deck.name}
        </Typography>

        <Button
          startIcon={<ExportIcon />}
          onClick={handleExportSlide}
          disabled={!selectedSlideId}
          size="small"
          variant="outlined"
          sx={{ mr: 1 }}
        >
          Export Slide
        </Button>

        <IconButton
          onClick={() => navigate(`/decks/${deckId}`)}
          size="small"
          title="Deck Settings"
        >
          <SettingsIcon />
        </IconButton>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel: Slide Thumbnails */}
        <SlidePanel
          slides={slides}
          selectedSlideId={selectedSlideId}
          onSelectSlide={handleSelectSlide}
          onDeleteSlide={handleDeleteSlide}
          onAddSlide={handleAddSlide}
          onAddSlideBefore={handleAddSlideBefore}
          onAddSlideAfter={handleAddSlideAfter}
          onReorderSlides={handleReorderSlides}
          onToggleNoImages={handleToggleNoImages}
          deckId={deckId}
        />

        {/* Right Panel: Slide Editor */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.default',
          }}
        >
          {selectedSlide ? (
            <SlideEditor
              key={selectedSlide.id}
              slideData={selectedSlide}
              deckId={deckId}
              slideId={selectedSlide.id}
              isEmbedded={true}
              onSlideChange={refreshSlides}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 4,
              }}
            >
              <Typography variant="h5" color="text.secondary" gutterBottom>
                No slide selected
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                {slides.length === 0
                  ? 'Create your first slide to get started'
                  : 'Select a slide from the panel to edit it'}
              </Typography>
              {slides.length === 0 && (
                <Button variant="contained" onClick={handleAddSlide}>
                  Create First Slide
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={cancelDelete}
      >
        <DialogTitle>Delete Slide?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this slide? This action cannot be undone.
            All generated images for this slide will also be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Slide Dialog */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleExportCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Export Slide to Google Slides</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will create a new Google Slides presentation with only the selected slide.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Presentation Title"
            value={exportTitle}
            onChange={(e) => setExportTitle(e.target.value)}
            placeholder="Enter presentation title..."
            disabled={exporting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleExportCancel} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExportConfirm}
            variant="contained"
            disabled={!exportTitle.trim() || exporting}
            startIcon={exporting ? <CircularProgress size={20} /> : <ExportIcon />}
          >
            {exporting ? 'Exporting...' : 'Export'}
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
    </Box>
  );
}
