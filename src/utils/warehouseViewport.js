import { bboxContains, padBbox } from '../services/geoService';

export const EMPTY_WAREHOUSE_POINTS = { type: 'FeatureCollection', features: [] };

/** Keep padded requests within the GIS API's 30-degree viewport limit. */
export function warehouseRequestBbox(visible) {
  const parts = visible.split(',').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  const span = Math.max(e - w, n - s);
  if (w >= e || s >= n || w < -180 || e > 180 || s < -90 || n > 90 || span > 30) return null;
  return padBbox(visible, Math.min(0.4, Math.max(0, (30 / span - 1) / 2)));
}

/**
 * One bounded warehouse source. Cache complete padded areas, cancel superseded
 * requests, and never reuse a truncated result for a different viewport.
 */
export function createWarehouseViewportLoader({ fetchPoints, onData, onStatus }) {
  let cached = null;
  let pending = null;
  let version = 0;
  let filterKey = null;
  let latestVisible = null;

  const cancel = () => {
    version += 1;
    pending?.controller.abort();
    pending = null;
  };

  const reset = () => {
    cancel();
    cached = null;
    onData(EMPTY_WAREHOUSE_POINTS);
    onStatus({ loading: false, error: null, count: 0, truncated: false, zoomRequired: false });
  };

  async function load(visible, filters = {}, force = false) {
    latestVisible = visible;
    const key = JSON.stringify(filters);
    if (key !== filterKey) {
      reset();
      filterKey = key;
    }
    const bbox = warehouseRequestBbox(visible);
    if (!bbox) {
      reset();
      onStatus({ zoomRequired: true });
      return;
    }
    const covered = cached && bboxContains(cached.bbox, visible)
      && (!cached.truncated || cached.visible === visible);
    if (!force && covered) {
      cancel();
      onStatus({ loading: false, error: null });
      return;
    }
    if (!force && pending?.key === key && bboxContains(pending.bbox, visible)) return;

    cancel();
    const requestVersion = version;
    const controller = new AbortController();
    pending = { bbox, key, controller };
    onStatus({ loading: true, error: null, zoomRequired: false });
    try {
      const fc = await fetchPoints({ bbox, filters, limit: 2000, signal: controller.signal });
      if (requestVersion !== version) return;
      if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new Error('Invalid map response');
      cached = { bbox, visible, truncated: !!fc.truncated };
      pending = null;
      onData(fc);
      onStatus({ loading: false, error: null, count: fc.features.length, truncated: !!fc.truncated });
      // A zoom during an in-flight padded request must still get a complete
      // closer view when that first response turns out to have hit the cap.
      if (fc.truncated && latestVisible !== visible) void load(latestVisible, filters, true);
    } catch {
      if (requestVersion !== version) return;
      pending = null;
      onStatus({ loading: false, error: 'Could not update warehouse pins. Please retry.' });
    }
  }

  return { load, reset, dispose: cancel };
}
