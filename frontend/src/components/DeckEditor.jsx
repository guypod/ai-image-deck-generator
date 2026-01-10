import React, { useState } from 'react';
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
} from '@mui/material';
import { ArrowBack, Add, Delete, Edit, ImageNotSupported } from '@mui/icons-material';
import { useDeck } from '../hooks/useDecks';
import { useSlides } from '../hooks/useSlides';
import { slideAPI } from '../services/api';
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

  React.useEffect(() => {
    if (deck) {
      setName(deck.name);
      setVisualStyle(deck.visualStyle);
      setIsTest(deck.isTest || false);
    }
  }, [deck]);

  const handleEntityUpdate = () => {
    refresh();
  };

  const handleSaveName = async () => {
    try {
      await updateDeck({ name });
      setEditingName(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveStyle = async () => {
    try {
      await updateDeck({ visualStyle });
      setEditingStyle(false);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleIsTestChange = async (newIsTest) => {
    try {
      await updateDeck({ isTest: newIsTest });
      setIsTest(newIsTest);
    } catch (err) {
      alert(`Error: ${err.message}`);
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
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteSlide = async (slideId) => {
    if (!confirm('Delete this slide?')) return;
    try {
      await deleteSlide(slideId);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleToggleNoImages = async (slideId, currentValue) => {
    try {
      await updateSlide(slideId, { noImages: !currentValue });
    } catch (err) {
      alert(`Error: ${err.message}`);
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
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 3 }}
      >
        Back to Decks
      </Button>

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
                    onClick={() => handleDeleteSlide(slide.id)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
