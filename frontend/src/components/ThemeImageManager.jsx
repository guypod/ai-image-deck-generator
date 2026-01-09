import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardMedia,
  CardActions,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import { Add, Delete, CloudUpload } from '@mui/icons-material';

export default function ThemeImageManager({ deckId, themeImages, onUpdate }) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleAddThemeImage = async () => {
    if (!selectedFile) {
      setError('Image file is required');
      return;
    }

    if (themeImages.length >= 10) {
      setError('Maximum 10 theme images allowed per deck');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch(`http://localhost:3001/api/decks/${deckId}/theme-images`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add theme image');
      }

      await response.json();
      onUpdate();

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setAddDialogOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteThemeImage = async (filename) => {
    if (!confirm('Delete this theme image? This will affect the tone of all generated images.')) {
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3001/api/decks/${deckId}/theme-images/${filename}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete theme image');
      }

      await response.json();
      onUpdate();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const imageList = themeImages || [];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Theme Images ({imageList.length}/10)
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDialogOpen(true)}
          size="small"
          disabled={imageList.length >= 10}
        >
          Add Theme Image
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
        Theme images set the visual tone for all generated images in this deck. AI will match the style, mood, and aesthetic of your theme images.
      </Typography>

      {imageList.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No theme images yet. Add theme images to influence the visual style of all generated images.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {imageList.map((filename, index) => (
            <Grid item xs={12} sm={6} md={4} key={filename}>
              <Card>
                <CardMedia
                  component="img"
                  height="140"
                  image={`http://localhost:3001/api/decks/${deckId}/theme-images/${filename}`}
                  alt={`Theme ${index + 1}`}
                  sx={{ objectFit: 'cover' }}
                />
                <CardActions>
                  <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
                    Theme {index + 1}
                  </Typography>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteThemeImage(filename)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Theme Image Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Theme Image</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload a reference image that represents the visual style you want for all slides in this deck.
            The AI will match the tone, colors, and aesthetic of your theme images.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="theme-image-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="theme-image-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUpload />}
                fullWidth
              >
                Select Image
              </Button>
            </label>
          </Box>

          {previewUrl && (
            <Box mt={2}>
              <img
                src={previewUrl}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  objectFit: 'contain',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={handleAddThemeImage}
            variant="contained"
            disabled={uploading || !selectedFile}
          >
            {uploading ? 'Uploading...' : 'Add Theme Image'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
