import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  Snackbar,
  DialogContentText,
} from '@mui/material';
import { Add, Delete, Edit, ArrowDropDown } from '@mui/icons-material';
import { useDecks } from '../hooks/useDecks';
import { deckAPI } from '../services/api';

export default function DeckList() {
  const navigate = useNavigate();
  const { decks, loading, error, createDeck, deleteDeck, refresh } = useDecks();
  const [openDialog, setOpenDialog] = useState(false);
  const [openTextDialog, setOpenTextDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [deckName, setDeckName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const handleCreate = async () => {
    if (!deckName.trim()) return;

    setCreating(true);
    try {
      const newDeck = await createDeck({ name: deckName, visualStyle: '' });
      setOpenDialog(false);
      setDeckName('');
      navigate(`/decks/${newDeck.id}/edit`);
    } catch (err) {
      setSnackbar({ open: true, message: `Error creating deck: ${err.message}`, severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromText = async () => {
    if (!deckName.trim() || !textContent.trim()) return;

    setCreating(true);
    try {
      const response = await deckAPI.createFromText({
        name: deckName,
        text: textContent,
        visualStyle: ''
      });
      setOpenTextDialog(false);
      setDeckName('');
      setTextContent('');
      await refresh();
      navigate(`/decks/${response.data.deck.id}/edit`);
    } catch (err) {
      setSnackbar({ open: true, message: `Error creating deck from text: ${err.message}`, severity: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e, deckId, deckName) => {
    e.stopPropagation();
    setDeckToDelete({ id: deckId, name: deckName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deckToDelete) return;

    try {
      await deleteDeck(deckToDelete.id);
      setSnackbar({ open: true, message: 'Deck deleted successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error deleting deck: ${err.message}`, severity: 'error' });
    } finally {
      setDeleteDialogOpen(false);
      setDeckToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeckToDelete(null);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          My Slide Decks
        </Typography>
        <Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            endIcon={<ArrowDropDown />}
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            New Deck
          </Button>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem onClick={() => { setMenuAnchor(null); setOpenDialog(true); }}>
              Empty Deck
            </MenuItem>
            <MenuItem onClick={() => { setMenuAnchor(null); setOpenTextDialog(true); }}>
              From Text
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {decks.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No decks yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first slide deck to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenDialog(true)}
          >
            Create Deck
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {decks.map((deck) => (
            <Grid item xs={12} sm={6} md={4} key={deck.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {deck.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {deck.slides.length} slide{deck.slides.length !== 1 ? 's' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(deck.updatedAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<Edit />}
                    onClick={() => navigate(`/decks/${deck.id}/edit`)}
                  >
                    Edit Slides
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => handleDeleteClick(e, deck.id, deck.name)}
                  >
                    <Delete />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Deck Dialog */}
      <Dialog open={openDialog} onClose={() => !creating && setOpenDialog(false)}>
        <DialogTitle>Create New Deck</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Deck Name"
            fullWidth
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            disabled={creating}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={!deckName.trim() || creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Deck from Text Dialog */}
      <Dialog
        open={openTextDialog}
        onClose={() => !creating && setOpenTextDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Deck from Text</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Deck Name"
            fullWidth
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            disabled={creating}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Paste your text here"
            fullWidth
            multiline
            rows={10}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            disabled={creating}
            placeholder="Each line or bullet will become a slide.&#10;Empty lines are ignored.&#10;Use ~name to reference entities (will become @name)"
            helperText="Each line or bullet becomes a slide. Use ~name for entities (converts to @name)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTextDialog(false)} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateFromText}
            variant="contained"
            disabled={!deckName.trim() || !textContent.trim() || creating}
          >
            {creating ? 'Creating...' : 'Create Deck'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
      >
        <DialogTitle>Delete Deck?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{deckToDelete?.name}"? This action cannot be undone.
            All slides and generated images will be permanently deleted.
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
    </Container>
  );
}
