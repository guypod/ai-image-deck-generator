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
} from '@mui/material';
import { ArrowBack, Settings as SettingsIcon } from '@mui/icons-material';
import { useDeck } from '../hooks/useDecks';
import { useSlides } from '../hooks/useSlides';
import SlidePanel from './SlidePanel';
import SlideEditor from './SlideEditor';

export default function SlideDeckView() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { deck, loading: deckLoading, error: deckError } = useDeck(deckId);
  const { slides, loading: slidesLoading, createSlide, deleteSlide, reorderSlides, refresh: refreshSlides } = useSlides(deckId);

  const [selectedSlideId, setSelectedSlideId] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slideToDelete, setSlideToDelete] = useState(null);

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
      alert(`Error creating slide: ${error.message}`);
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
      alert(`Error deleting slide: ${error.message}`);
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
      alert(`Error reordering slides: ${error.message}`);
      // The useSlides hook will refresh and show the old order
    }
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
          onReorderSlides={handleReorderSlides}
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
    </Box>
  );
}
