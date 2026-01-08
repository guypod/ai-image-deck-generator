import { useState, useEffect, useCallback } from 'react';
import { deckAPI } from '../services/api';

export function useDecks() {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await deckAPI.getAll();
      setDecks(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  const createDeck = async (data) => {
    try {
      const response = await deckAPI.create(data);
      await fetchDecks();
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const updateDeck = async (id, data) => {
    try {
      const response = await deckAPI.update(id, data);
      await fetchDecks();
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteDeck = async (id) => {
    try {
      await deckAPI.delete(id);
      await fetchDecks();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  return {
    decks,
    loading,
    error,
    refresh: fetchDecks,
    createDeck,
    updateDeck,
    deleteDeck,
  };
}

export function useDeck(deckId) {
  const [deck, setDeck] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDeck = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await deckAPI.getById(deckId);
      setDeck(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchDeck();
  }, [fetchDeck]);

  const updateDeck = async (data) => {
    try {
      const response = await deckAPI.update(deckId, data);
      setDeck(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const addEntity = async (entityName, imageFile) => {
    const formData = new FormData();
    formData.append('entityName', entityName);
    formData.append('image', imageFile);

    try {
      const response = await deckAPI.addEntity(deckId, formData);
      setDeck(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const removeEntity = async (entityName) => {
    try {
      const response = await deckAPI.removeEntity(deckId, entityName);
      setDeck(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  return {
    deck,
    loading,
    error,
    refresh: fetchDeck,
    updateDeck,
    addEntity,
    removeEntity,
  };
}
