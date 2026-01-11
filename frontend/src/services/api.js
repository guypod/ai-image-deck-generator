import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// Deck API
export const deckAPI = {
  getAll: () => api.get('/decks'),
  getById: (id) => api.get(`/decks/${id}`),
  create: (data) => api.post('/decks', data),
  createFromText: (data) => api.post('/decks/from-text', data),
  update: (id, data) => api.put(`/decks/${id}`, data),
  delete: (id) => api.delete(`/decks/${id}`),
  addEntity: (deckId, formData) =>
    api.post(`/decks/${deckId}/entities`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  removeEntity: (deckId, entityName) =>
    api.delete(`/decks/${deckId}/entities/${entityName}`),
  getEntityImage: (deckId, entityName, filename) =>
    `${API_BASE_URL}/decks/${deckId}/entities/${entityName}/${filename}`,
  exportSlide: (deckId, slideId, data) =>
    api.post(`/decks/${deckId}/slides/${slideId}/export`, data),
};

// Slide API
export const slideAPI = {
  getAll: (deckId) => api.get(`/decks/${deckId}/slides`, {
    headers: { 'Cache-Control': 'no-cache' }
  }),
  getById: (deckId, slideId) => api.get(`/decks/${deckId}/slides/${slideId}`, {
    headers: { 'Cache-Control': 'no-cache' },
    params: { _t: Date.now() } // Cache busting
  }),
  create: (deckId, data) => api.post(`/decks/${deckId}/slides`, data),
  update: (deckId, slideId, data) =>
    api.put(`/decks/${deckId}/slides/${slideId}`, data),
  delete: (deckId, slideId) =>
    api.delete(`/decks/${deckId}/slides/${slideId}`),
  reorder: (deckId, slideIds) =>
    api.post(`/decks/${deckId}/slides/reorder`, { slideIds }),
  getImage: (deckId, slideId, imageId) =>
    `${API_BASE_URL}/decks/${deckId}/slides/${slideId}/images/${imageId}`,
  pinImage: (deckId, slideId, imageId) =>
    api.put(`/decks/${deckId}/slides/${slideId}/images/${imageId}/pin`),
  deleteImage: (deckId, slideId, imageId) =>
    api.delete(`/decks/${deckId}/slides/${slideId}/images/${imageId}`),
};

// Image generation API
export const imageAPI = {
  generate: (deckId, slideId, data) =>
    api.post(`/decks/${deckId}/slides/${slideId}/generate`, data),
  tweak: (deckId, slideId, data) =>
    api.post(`/decks/${deckId}/slides/${slideId}/tweak`, data),
  generateAll: (deckId, data) =>
    api.post(`/decks/${deckId}/generate-all`, data),
  generateMissing: (deckId, data) =>
    api.post(`/decks/${deckId}/generate-missing`, data),
  getJobStatus: (jobId) => api.get(`/jobs/${jobId}`),
};

// Settings API
export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  testApiKey: (data) => api.post('/settings/test-api-key', data),
  uploadPowerPointTemplate: (file) => {
    const formData = new FormData();
    formData.append('template', file);
    return api.post('/settings/powerpoint-template', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  deletePowerPointTemplate: () => api.delete('/settings/powerpoint-template'),
};

// Global Entities API
export const globalEntitiesAPI = {
  getAll: () => api.get('/settings/global-entities'),
  add: (data) => api.post('/settings/global-entities', data),
  remove: (entityName) => api.delete(`/settings/global-entities/${entityName}`),
  getImage: (entityName, filename) =>
    `${API_BASE_URL}/settings/global-entities/${entityName}/${filename}`,
};

// Export API
export const exportAPI = {
  toGoogleSlides: (deckId, data) =>
    api.post(`/decks/${deckId}/export`, data),
  toPowerPoint: (deckId, data) =>
    api.post(`/decks/${deckId}/export-pptx`, data, { responseType: 'blob' }),
  getExportState: (deckId) =>
    api.get(`/decks/${deckId}/export-state`),
  clearExportState: (deckId) =>
    api.delete(`/decks/${deckId}/export-state`),
};

export default api;
