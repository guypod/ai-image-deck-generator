import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

// Components
import DeckList from './components/DeckList';
import DeckEditor from './components/DeckEditor';
import SlideEditor from './components/SlideEditor';
import SlideDeckView from './components/SlideDeckView';
import Settings from './components/Settings';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ flexGrow: 1 }}>
          <AppBar position="static">
            <Toolbar>
              <Typography
                variant="h6"
                component={Link}
                to="/"
                sx={{
                  flexGrow: 1,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                AI Image Deck Generator
              </Typography>
              <Button
                color="inherit"
                startIcon={<SettingsIcon />}
                component={Link}
                to="/settings"
              >
                Settings
              </Button>
            </Toolbar>
          </AppBar>

          <Routes>
            <Route path="/" element={<DeckList />} />
            <Route path="/decks/:deckId" element={<DeckEditor />} />
            <Route path="/decks/:deckId/edit" element={<SlideDeckView />} />
            <Route path="/decks/:deckId/slides/:slideId" element={<SlideEditor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
