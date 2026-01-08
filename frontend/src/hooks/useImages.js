import { useState } from 'react';
import { imageAPI } from '../services/api';

export function useImages(deckId, slideId) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generateImages = async (count, service) => {
    setGenerating(true);
    setError(null);
    try {
      const response = await imageAPI.generate(deckId, slideId, { count, service });
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const tweakImage = async (imageId, prompt, count) => {
    setGenerating(true);
    setError(null);
    try {
      const response = await imageAPI.tweak(deckId, slideId, {
        imageId,
        prompt,
        count,
      });
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generating,
    error,
    generateImages,
    tweakImage,
  };
}

export function useBulkOperations(deckId) {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  const startGenerateAll = async (count, service) => {
    try {
      const response = await imageAPI.generateAll(deckId, { count, service });
      setJobId(response.data.jobId);
      startPolling(response.data.jobId);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const startGenerateMissing = async (count, service) => {
    try {
      const response = await imageAPI.generateMissing(deckId, { count, service });
      if (response.data.message) {
        // No images to generate
        return response.data;
      }
      setJobId(response.data.jobId);
      startPolling(response.data.jobId);
      return response.data;
    } catch (err) {
      throw new Error(err.message);
    }
  };

  const startPolling = (id) => {
    setPolling(true);
    const interval = setInterval(async () => {
      try {
        const response = await imageAPI.getJobStatus(id);
        setStatus(response.data);

        if (response.data.status === 'completed' || response.data.status === 'failed') {
          clearInterval(interval);
          setPolling(false);
        }
      } catch (err) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 2000);

    // Store interval ID for cleanup
    return () => clearInterval(interval);
  };

  const reset = () => {
    setJobId(null);
    setStatus(null);
    setPolling(false);
  };

  return {
    jobId,
    status,
    polling,
    startGenerateAll,
    startGenerateMissing,
    reset,
  };
}
