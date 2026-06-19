import { apiClient } from './apiClient.js';

// Reviewer-drawn micro-market areas. The backend returns GeoJSON
// (FeatureCollection on list, Feature on create/update). apiClient attaches the
// dashboard JWT automatically, so these calls are authenticated + reviewer-gated.
export const microMarketService = {
  list: () => apiClient.get('/micro-markets'),
  create: (data) => apiClient.post('/micro-markets', data),
  update: (id, data) => apiClient.put(`/micro-markets/${id}`, data),
  delete: (id) => apiClient.delete(`/micro-markets/${id}`),
};
