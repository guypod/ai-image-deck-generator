import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  DialogContentText,
  Snackbar,
} from '@mui/material';
import { Add, Delete, CloudUpload } from '@mui/icons-material';
import { useGlobalEntities } from '../hooks/useGlobalEntities';
import { globalEntitiesAPI } from '../services/api';

export default function GlobalEntityManager() {
  const { entities, loading, addEntity, removeEntity } = useGlobalEntities();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState(null);
  const [entityName, setEntityName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

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

  const handleAddEntity = async () => {
    if (!entityName.trim()) {
      setError('Entity name is required');
      return;
    }

    if (!selectedFile) {
      setError('Image file is required');
      return;
    }

    // Validate entity name format (alphanumeric + hyphens)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/.test(entityName)) {
      setError('Entity name must be alphanumeric with hyphens (no spaces)');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await addEntity(entityName, selectedFile);

      // Reset form
      setEntityName('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setAddDialogOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (entityName) => {
    setEntityToDelete(entityName);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entityToDelete) return;

    try {
      await removeEntity(entityToDelete);
      setSnackbar({ open: true, message: 'Global entity deleted successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setEntityToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setEntityToDelete(null);
  };

  const entityList = Object.entries(entities || {});

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6">
            Global Entities ({entityList.length})
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Available to all decks. Use @EntityName to reference them.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDialogOpen(true)}
          size="small"
        >
          Add Entity
        </Button>
      </Box>

      {entityList.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No global entities yet. Global entities can be referenced in any deck using @EntityName
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {entityList.map(([name, entity]) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={name}>
              <Card>
                <CardMedia
                  component="img"
                  height="140"
                  image={globalEntitiesAPI.getImage(name, entity.images[0])}
                  alt={name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ pb: 1 }}>
                  <Typography variant="subtitle2" noWrap>
                    @{name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entity.images.length} image(s)
                  </Typography>
                </CardContent>
                <CardActions>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteClick(name)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Entity Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Global Entity</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Upload a reference image that can be used in any deck with @EntityName
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Entity Name"
            value={entityName}
            onChange={(e) => setEntityName(e.target.value)}
            placeholder="e.g., Alice, Company-Logo"
            helperText="Use alphanumeric characters and hyphens (no spaces)"
            sx={{ mb: 3, mt: 1 }}
          />

          <Box>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="global-entity-image-upload"
              type="file"
              onChange={handleFileSelect}
            />
            <label htmlFor="global-entity-image-upload">
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
            onClick={handleAddEntity}
            variant="contained"
            disabled={uploading || !entityName || !selectedFile}
          >
            {uploading ? 'Uploading...' : 'Add Global Entity'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Global Entity?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{entityToDelete}"? This will affect all decks using this entity. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
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
    </Box>
  );
}
