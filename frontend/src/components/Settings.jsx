import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { ArrowBack, Check, Close } from '@mui/icons-material';
import { useSettings } from '../hooks/useSettings';

export default function Settings() {
  const navigate = useNavigate();
  const { settings, loading, updateSettings, testApiKey } = useSettings();

  const [googleImagenKey, setGoogleImagenKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [defaultService, setDefaultService] = useState('google-imagen');
  const [defaultVariantCount, setDefaultVariantCount] = useState(2);
  const [saving, setSaving] = useState(false);
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [googleStatus, setGoogleStatus] = useState(null);
  const [openaiStatus, setOpenaiStatus] = useState(null);

  useEffect(() => {
    if (settings) {
      setDefaultService(settings.defaultService);
      setDefaultVariantCount(settings.defaultVariantCount);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        defaultService,
        defaultVariantCount,
      };

      if (googleImagenKey && googleImagenKey !== '***masked***') {
        updates.apiKeys = { ...updates.apiKeys, googleImagen: googleImagenKey };
      }

      if (openaiKey && openaiKey !== '***masked***') {
        updates.apiKeys = { ...updates.apiKeys, openaiDalle: openaiKey };
      }

      await updateSettings(updates);
      alert('Settings saved successfully');
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGoogle = async () => {
    if (!googleImagenKey || googleImagenKey === '***masked***') {
      alert('Please enter a Google Imagen API key first');
      return;
    }

    setTestingGoogle(true);
    try {
      const result = await testApiKey('google-imagen', googleImagenKey);
      setGoogleStatus(result);
    } catch (err) {
      setGoogleStatus({ valid: false, message: err.message });
    } finally {
      setTestingGoogle(false);
    }
  };

  const handleTestOpenAI = async () => {
    if (!openaiKey || openaiKey === '***masked***') {
      alert('Please enter an OpenAI API key first');
      return;
    }

    setTestingOpenAI(true);
    try {
      const result = await testApiKey('openai-dalle', openaiKey);
      setOpenaiStatus(result);
    } catch (err) {
      setOpenaiStatus({ valid: false, message: err.message });
    } finally {
      setTestingOpenAI(false);
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
          API Keys
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Configure your AI service API keys. Keys are stored securely on your local machine.
        </Typography>

        <Box mb={3}>
          <TextField
            fullWidth
            label="Google Imagen API Key"
            type="password"
            value={googleImagenKey}
            onChange={(e) => setGoogleImagenKey(e.target.value)}
            placeholder={settings?.apiKeys?.googleImagen ? '***masked***' : 'Enter your key...'}
            helperText="Get your key from Google Cloud Console"
            sx={{ mb: 1 }}
          />
          <Box display="flex" gap={1} alignItems="center">
            <Button
              size="small"
              onClick={handleTestGoogle}
              disabled={testingGoogle}
            >
              {testingGoogle ? 'Testing...' : 'Test Key'}
            </Button>
            {googleStatus && (
              <Box display="flex" alignItems="center" gap={0.5}>
                {googleStatus.valid ? <Check color="success" /> : <Close color="error" />}
                <Typography variant="caption" color={googleStatus.valid ? 'success.main' : 'error.main'}>
                  {googleStatus.message}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Box mb={3}>
          <TextField
            fullWidth
            label="OpenAI API Key"
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder={settings?.apiKeys?.openaiDalle ? '***masked***' : 'Enter your key...'}
            helperText="Get your key from OpenAI Platform"
            sx={{ mb: 1 }}
          />
          <Box display="flex" gap={1} alignItems="center">
            <Button
              size="small"
              onClick={handleTestOpenAI}
              disabled={testingOpenAI}
            >
              {testingOpenAI ? 'Testing...' : 'Test Key'}
            </Button>
            {openaiStatus && (
              <Box display="flex" alignItems="center" gap={0.5}>
                {openaiStatus.valid ? <Check color="success" /> : <Close color="error" />}
                <Typography variant="caption" color={openaiStatus.valid ? 'success.main' : 'error.main'}>
                  {openaiStatus.message}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

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
            <MenuItem value="google-imagen">Google Imagen</MenuItem>
            <MenuItem value="openai-dalle">OpenAI DALL-E</MenuItem>
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
