/**
 * Parse a pasted location into coordinates.
 *
 * Whoever fills this in is looking at Google Maps, so what lands in the field is
 * whatever that page offered to copy. In practice that is one of three things,
 * and all three are accepted rather than asking the user to reformat:
 *
 *   1. a bare pair from the "copy coordinates" menu   XX.XXXXXX, YY.YYYYYY
 *   2. a place URL, where the view centre is the @-segment
 *   3. a search/share URL, where the point is in ?q= or ?query=
 *
 * A short `maps.app.goo.gl` link is deliberately NOT handled: it carries no
 * coordinates at all, only an id the Maps servers resolve. Accepting it would
 * mean silently sending nothing, so it is rejected with a message saying to open
 * the link and copy the coordinates instead.
 *
 * Order matters. A place URL contains BOTH an @-segment (the map centre, which
 * is what the eye is on) and often a `!3d`/`!4d` pair (the place's own point).
 * The @-segment is checked first because it is the one the user is looking at.
 */

/** India's bounding box, generously padded. Used only to warn, never to reject. */
const INDIA_BOUNDS = { minLat: 6, maxLat: 37, minLng: 68, maxLng: 98 };

const inRange = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng)
  && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * @param {string} raw
 * @returns {{lat: number, lng: number}|null} null when nothing parseable is present
 */
export function parseLatLng(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  // A shortened link resolves server-side and contains no coordinates.
  if (/goo\.gl|maps\.app/i.test(text)) return null;

  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`@${num},${num}`),                       // /maps/place/.../@lat,lng,17z
    new RegExp(`[?&](?:q|query|ll|center|daddr)=${num},${num}`, 'i'),
    new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`),        // a bare pasted pair
    new RegExp(`!3d${num}!4d${num}`),                   // the place's own point
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (inRange(lat, lng)) return { lat, lng };
  }
  return null;
}

/**
 * Validation state for the input, as one object the field can render directly.
 *
 * Three states, not two: empty is not an error. The field is optional — leaving
 * it blank omits one slide, which is a choice, not a mistake — so an untouched
 * field must not show red.
 *
 * @param {string} raw
 * @returns {{status: 'empty'|'ok'|'error', coords: {lat, lng}|null, message: string}}
 */
export function describeLatLngInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return { status: 'empty', coords: null, message: '' };

  const coords = parseLatLng(text);
  if (!coords) {
    const shortened = /goo\.gl|maps\.app/i.test(text);
    return {
      status: 'error',
      coords: null,
      message: shortened
        ? 'Shortened Maps links carry no coordinates — open it, then copy the coordinates.'
        : 'Could not read coordinates. Paste a "latitude, longitude" pair or a full Maps URL.',
    };
  }

  const { lat, lng } = coords;
  // Transposed coordinates are the one mistake that yields a valid-looking point
  // somewhere in the Indian Ocean, so it is worth naming specifically.
  const outside = lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat
    || lng < INDIA_BOUNDS.minLng || lng > INDIA_BOUNDS.maxLng;
  const swapped = outside && inRange(lng, lat)
    && lng >= INDIA_BOUNDS.minLat && lng <= INDIA_BOUNDS.maxLat
    && lat >= INDIA_BOUNDS.minLng && lat <= INDIA_BOUNDS.maxLng;

  return {
    status: 'ok',
    coords,
    message: swapped
      ? `${lat}, ${lng} — outside India, and reads like a transposed pair. Check the order.`
      : outside
        ? `${lat}, ${lng} — outside India. Check it is the right point.`
        : `${lat}, ${lng}`,
  };
}
