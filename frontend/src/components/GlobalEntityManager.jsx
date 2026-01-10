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
} from '@mui/material';
import { Add, Delete, CloudUpload } from '@mui/icons-material';
import { useGlobalEntities } from '../hooks/useGlobalEntities';
import { globalEntitiesAPI } from '../services/api';

export default function GlobalEntityManager() {
  const { entities, loading, addEntity, removeEntity } = useGlobalEntities();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [entityName, setEntityName] = useState('');
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

  const handleDeleteEntity = async (entityName) => {
    if (!confirm(`Delete global entity "${entityName}"? This will affect all decks using this entity. This cannot be undone.`)) {
      return;
    }

    try {
      await removeEntity(entityName);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
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
                    onClick={() => handleDeleteEntity(name)}
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
    </Box>
  );
}
