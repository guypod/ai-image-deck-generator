import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useSettings } from '../hooks/useSettings';
import GlobalEntityManager from './GlobalEntityManager';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, loading, updateSettings } = useSettings();

  const [defaultService, setDefaultService] = useState('gemini-pro');
  const [defaultVariantCount, setDefaultVariantCount] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setDefaultService(settings.defaultService);
      setDefaultVariantCount(settings.defaultVariantCount);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        defaultService,
        defaultVariantCount,
      });
      alert('Settings saved successfully');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/')}
        sx={{ mb: 3 }}
      >
        Back to Decks
      </Button>

      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          API Keys Configuration
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2" paragraph sx={{ mb: 1 }}>
            API keys are now configured via environment variables in the backend <code>.env</code> file for better security.
          </Typography>
          <Typography variant="body2" component="div">
            Required environment variables:
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li><code>GEMINI_API_KEY</code> - Get from <a href="https://ai.google.dev" target="_blank" rel="noopener noreferrer">Google AI Studio</a></li>
              <li><code>OPENAI_API_KEY</code> - Get from <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">OpenAI Platform</a></li>
              <li><code>GOOGLE_IMAGEN_API_KEY</code> - Get from <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
            </ul>
          </Typography>
        </Alert>

        <Typography variant="body2" color="text.secondary" paragraph>
          Add these keys to <code>backend/.env</code> and restart the backend server.
        </Typography>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Defaults
        </Typography>

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Default AI Service</InputLabel>
          <Select
            value={defaultService}
            label="Default AI Service"
            onChange={(e) => setDefaultService(e.target.value)}
          >
            <MenuItem value="openai-gpt-image">OpenAI GPT Image</MenuItem>
            <MenuItem value="gemini-flash">Gemini Flash</MenuItem>
            <MenuItem value="gemini-pro">Gemini Pro</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Default Variant Count</InputLabel>
          <Select
            value={defaultVariantCount}
            label="Default Variant Count"
            onChange={(e) => setDefaultVariantCount(e.target.value)}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          fullWidth
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Global Entities
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Global entities are available across all decks. Reference them in any slide using @EntityName.
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <GlobalEntityManager />
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Google Slides Export
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Google Slides export feature coming soon. You'll be able to export your decks directly to Google Slides.
        </Typography>
      </Paper>
    </Container>
  );
}
