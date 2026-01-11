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
  TextField,
  Snackbar,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useSettings } from '../hooks/useSettings';
import GlobalEntityManager from './GlobalEntityManager';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, loading, updateSettings } = useSettings();

  const [defaultService, setDefaultService] = useState('gemini-pro');
  const [defaultVariantCount, setDefaultVariantCount] = useState(2);
  const [googleSlidesTemplateUrl, setGoogleSlidesTemplateUrl] = useState('');
  const [googleSlidesTemplateIndex, setGoogleSlidesTemplateIndex] = useState(1);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (settings) {
      setDefaultService(settings.defaultService);
      setDefaultVariantCount(settings.defaultVariantCount);
      setGoogleSlidesTemplateUrl(settings.googleSlides?.templateSlideUrl || '');
      setGoogleSlidesTemplateIndex(settings.googleSlides?.templateSlideIndex || 1);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        defaultService,
        defaultVariantCount,
        googleSlidesTemplateUrl: googleSlidesTemplateUrl || null,
        googleSlidesTemplateIndex: googleSlidesTemplateIndex || 1,
      });
      setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
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
          Configure the template slide for Google Slides export. The template will be duplicated and your slides will be added to it.
        </Typography>

        <TextField
          fullWidth
          label="Template Slide URL"
          value={googleSlidesTemplateUrl}
          onChange={(e) => setGoogleSlidesTemplateUrl(e.target.value)}
          placeholder="https://docs.google.com/presentation/d/..."
          helperText="Paste a link to your Google Slides template. Make sure it's shared with anyone who has the link."
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          type="number"
          label="Template Slide Index"
          value={googleSlidesTemplateIndex}
          onChange={(e) => setGoogleSlidesTemplateIndex(parseInt(e.target.value) || 1)}
          placeholder="1"
          helperText="Which slide number in the template to use as the base (1 = first slide, 2 = second slide, etc.)"
          inputProps={{ min: 1 }}
          sx={{ mb: 2 }}
        />

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>To set up Google Slides export:</strong>
            <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
              <li>Create a Google Slides presentation to use as a template</li>
              <li>Share it with "Anyone with the link can view"</li>
              <li>Copy the presentation URL and paste it above</li>
              <li>Click "Save Settings" below</li>
            </ol>
          </Typography>
        </Alert>

        <Button
          fullWidth
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Paper>

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
