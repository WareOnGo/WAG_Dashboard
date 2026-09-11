import { geoService } from '../services/geoService';

/**
 * Lightweight warehouse candidates for the existing client-side city suggestion.
 * This changes only the point data read: polygon geometry and ray casting stay
 * as before. Query the drawn area, even with pins hidden or the map still loading.
 */
export async function warehousesForCitySuggestion(geometry, { signal, fetchPoints = geoService.warehouses } = {}) {
  const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : null;
  if (!ring?.length) return [];
  const xs = ring.map(point => point[0]), ys = ring.map(point => point[1]);
  if ([...xs, ...ys].some(value => !Number.isFinite(value))) return [];
  const west = Math.max(-180, Math.min(...xs)), east = Math.min(180, Math.max(...xs));
  const south = Math.max(-90, Math.min(...ys)), north = Math.min(90, Math.max(...ys));
  const rows = new Map();
  // A large drawn region still respects the GIS API's 30-degree bbox limit.
  for (let w = west; w < east; w += 30) {
    for (let s = south; s < north; s += 30) {
      const bbox = [w, s, Math.min(w + 30, east), Math.min(s + 30, north)].join(',');
      let afterId;
      while (true) {
        signal?.throwIfAborted();
        const fc = await fetchPoints({ bbox, limit: 2000, afterId, signal });
        if (fc?.type !== 'FeatureCollection' || !Array.isArray(fc.features)) throw new Error('Invalid warehouse points');
        let cursor = afterId ?? 0;
        for (const feature of fc.features) {
          const id = Number(feature.properties?.id);
          if (!Number.isSafeInteger(id) || id <= 0) continue;
          cursor = Math.max(cursor, id);
          rows.set(id, {
            id, city: feature.properties.city,
            longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1],
          });
        }
        if (!fc.truncated) break;
        if (cursor <= (afterId ?? 0)) throw new Error('Warehouse point cursor did not advance');
        afterId = cursor;
      }
    }
  }
  return [...rows.values()];
}
