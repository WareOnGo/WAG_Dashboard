import { apiClient } from './apiClient.js';

/** Serialise a Mapbox LngLatBounds into the "west,south,east,north" the API expects. */
export const boundsToBbox = (bounds) => [
  bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth(),
].map((n) => n.toFixed(6)).join(',');

/**
 * Is `inner` fully contained by `outer`? Used to skip refetching when the user
 * pans within an area already loaded — the common case when nudging the map.
 */
export const bboxContains = (outer, inner) => {
  if (!outer || !inner) return false;
  const [ow, os, oe, on] = outer.split(',').map(Number);
  const [iw, is, ie, inn] = inner.split(',').map(Number);
  return ow <= iw && os <= is && oe >= ie && on >= inn;
};

/**
 * Grow a bbox by `factor` around its centre, so a small pan stays inside what was
 * already fetched. Costs a slightly larger response in exchange for far fewer
 * requests while the user moves around.
 */
export const padBbox = (bbox, factor = 0.4) => {
  const [w, s, e, n] = bbox.split(',').map(Number);
  const dx = (e - w) * factor, dy = (n - s) * factor;
  return [
    Math.max(w - dx, -180), Math.max(s - dy, -90),
    Math.min(e + dx, 180), Math.min(n + dy, 90),
  ].map((v) => v.toFixed(6)).join(',');
};

export const geoService = {
  /** Category names + counts for both sources, to build the layer toggles. */
  layers: () => apiClient.get('/geo/layers').then((r) => r?.data ?? r),

  /**
   * OSM reference points in a viewport.
   * @returns {Promise<Object>} GeoJSON FeatureCollection (with a `truncated` flag)
   */
  osmPois: ({ bbox, categories = [], limit }) => apiClient.get('/geo/osm-pois', {
    params: { bbox, categories: categories.join(','), limit },
  }),

  /** Our own points in a viewport. */
  points: ({ bbox, categories = [], limit }) => apiClient.get('/geo/points', {
    params: { bbox, categories: categories.join(','), limit },
  }),

  /** Warehouses in a viewport, as a FeatureCollection. */
  warehouses: ({ bbox, limit }) => apiClient.get('/geo/warehouses', { params: { bbox, limit } }),

  createPoint: (body) => apiClient.post('/geo/points', body).then((r) => r?.data ?? r),
  updatePoint: (id, body) => apiClient.put(`/geo/points/${id}`, body).then((r) => r?.data ?? r),
  deletePoint: (id) => apiClient.delete(`/geo/points/${id}`),
};
