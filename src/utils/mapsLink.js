// src/utils/mapsLink.js

/**
 * Build a coordinate-only Google Maps URL from a warehouse's latitude/longitude.
 *
 * The `googleLocation` links we collect are usually whatever the scout pasted —
 * often a shortened `maps.app.goo.gl` link or a place URL carrying opaque
 * `!3m1!4b1`-style data segments. Those forms frequently fail to resolve on
 * Apple devices. The Maps URL API form built here carries nothing but the
 * coordinates, so it opens consistently everywhere.
 *
 * @param {number|string|null|undefined} latitude
 * @param {number|string|null|undefined} longitude
 * @returns {string|null} The URL, or null if either coordinate is missing or invalid.
 */
export function buildCoordMapsLink(latitude, longitude) {
  const lat = typeof latitude === 'string' ? latitude.trim() : latitude;
  const lng = typeof longitude === 'string' ? longitude.trim() : longitude;
  if (lat === '' || lat === null || lat === undefined) return null;
  if (lng === '' || lng === null || lng === undefined) return null;

  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return null;

  return `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`;
}

/** Tooltip copy for the generated link, shown wherever the field is read-only. */
export const COORD_MAPS_LINK_TOOLTIP =
  'Generated from the extracted latitude/longitude, so it cannot be edited. '
  + 'Use it if the Google Maps link above fails to open — shortened and place-style '
  + 'links often do not open correctly on Apple devices.';
