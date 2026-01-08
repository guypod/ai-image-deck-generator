import { useState, useEffect, useCallback } from 'react';
import { slideAPI } from '../services/api';

export function useSlides(deckId) {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSlides = useCallback(async () => {
    if (!deckId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await slideAPI.getAll(deckId);
      setSlides(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  const createSlide = async (data) => {
    try {
      const response = await slideAPI.create(deckId, data);
      await fetchSlides();
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const updateSlide = async (slideId, data) => {
    try {
      const response = await slideAPI.update(deckId, slideId, data);
      await fetchSlides();
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteSlide = async (slideId) => {
    try {
      await slideAPI.delete(deckId, slideId);
      await fetchSlides();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const reorderSlides = async (slideIds) => {
    try {
      await slideAPI.reorder(deckId, slideIds);
      await fetchSlides();
    } catch (err) {
      throw new Error(err.message);
    }
  };

  return {
    slides,
    loading,
    error,
    refresh: fetchSlides,
    createSlide,
    updateSlide,
    deleteSlide,
    reorderSlides,
  };
}

export function useSlide(deckId, slideId) {
  const [slide, setSlide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSlide = useCallback(async () => {
    if (!deckId || !slideId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await slideAPI.getById(deckId, slideId);
      setSlide(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [deckId, slideId]);

  useEffect(() => {
    fetchSlide();
  }, [fetchSlide]);

  const updateSlide = async (data) => {
    try {
      const response = await slideAPI.update(deckId, slideId, data);
      setSlide(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const pinImage = async (imageId) => {
    try {
      const response = await slideAPI.pinImage(deckId, slideId, imageId);
      setSlide(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const deleteImage = async (imageId) => {
    try {
      const response = await slideAPI.deleteImage(deckId, slideId, imageId);
      setSlide(response.data);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  return {
    slide,
    loading,
    error,
    refresh: fetchSlide,
    updateSlide,
    pinImage,
    deleteImage,
  };
}
