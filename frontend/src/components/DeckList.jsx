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
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { useDecks } from '../hooks/useDecks';

export default function DeckList() {
  const navigate = useNavigate();
  const { decks, loading, error, createDeck, deleteDeck } = useDecks();
  const [openDialog, setOpenDialog] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!deckName.trim()) return;

    setCreating(true);
    try {
      const newDeck = await createDeck({ name: deckName, visualStyle: '' });
      setOpenDialog(false);
      setDeckName('');
      navigate(`/decks/${newDeck.id}`);
    } catch (err) {
      alert(`Error creating deck: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (deckId, deckName) => {
    if (!confirm(`Delete deck "${deckName}"? This cannot be undone.`)) return;

    try {
      await deleteDeck(deckId);
    } catch (err) {
      alert(`Error deleting deck: ${err.message}`);
    }
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
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
        >
          New Deck
        </Button>
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
                    onClick={() => navigate(`/decks/${deck.id}`)}
                  >
                    Edit
                  </Button>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(deck.id, deck.name)}
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
    </Container>
  );
}
