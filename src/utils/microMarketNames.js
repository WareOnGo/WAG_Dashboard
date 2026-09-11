// Unnamed polygons are stored as IDs in Warehouse.micromarket: Mapbox Draw
// generates 32-character alphanumeric IDs; the backend's default is a UUID.
const POLYGON_ID = /^(?:[a-z0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;

/** Display names for card chips, without changing the stored warehouse tags. */
export function getMicroMarketDisplayNames(value) {
  const tags = Array.isArray(value) ? value : [value];
  return [...new Set(tags
    .filter(tag => typeof tag === 'string')
    .map(tag => tag.trim())
    .filter(tag => tag && !POLYGON_ID.test(tag)))];
}
