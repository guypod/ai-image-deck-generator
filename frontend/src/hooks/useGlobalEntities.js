import { useState, useEffect, useCallback } from 'react';
import { globalEntitiesAPI } from '../services/api';

export function useGlobalEntities() {
  const [entities, setEntities] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await globalEntitiesAPI.getAll();
      setEntities(response.data);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch global entities:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const addEntity = async (entityName, imageFile) => {
    try {
      // Convert image to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const response = await globalEntitiesAPI.add({
        entityName,
        imageData: base64,
      });

      setEntities(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const removeEntity = async (entityName) => {
    try {
      const response = await globalEntitiesAPI.remove(entityName);
      setEntities(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const refresh = fetchEntities;

  return {
    entities,
    loading,
    error,
    addEntity,
    removeEntity,
    refresh,
  };
}
