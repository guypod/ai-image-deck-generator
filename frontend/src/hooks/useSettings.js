import { useState, useEffect, useCallback } from 'react';
import { settingsAPI } from '../services/api';

export function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await settingsAPI.get();
      setSettings(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (data) => {
    try {
      const response = await settingsAPI.update(data);
      setSettings(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const testApiKey = async (service, apiKey) => {
    try {
      const response = await settingsAPI.testApiKey({ service, apiKey });
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  return {
    settings,
    loading,
    error,
    refresh: fetchSettings,
    updateSettings,
    testApiKey,
  };
}
