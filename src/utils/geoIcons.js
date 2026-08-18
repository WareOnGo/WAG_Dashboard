/**
 * Runtime-generated map icons.
 *
 * Icons are drawn into canvases and registered with `map.addImage()` rather than
 * pulled from the style's sprite. The style is a Standard import whose sprite we
 * do not control (and which is already missing images — see the `in-state-4`
 * warning), so generating them here keeps the map independent of it.
 *
 * The visual grammar matters more than the artwork:
 *
 *   GLYPH  says WHAT a thing is   (fuel pump, hospital cross, warehouse)
 *   COLOUR says its STATUS        (only warehouses have a status)
 *
 * Before this, colour encoded availability on warehouses and category on POIs,
 * so a red hospital read as an unavailable warehouse. Category colours are now
 * drawn from a cool palette that deliberately excludes the green/amber/red
 * reserved for availability.
 */

/** Reserved for availability. Nothing else may use these three. */
export const AVAILABILITY_COLORS = {
  available: '#22c55e',
  unavailable: '#ef4444',
  unknown: '#eab308',
};

/**
 * Category badge colours — cool hues only, so they can never be mistaken for an
 * availability signal.
 */
export const CATEGORY_COLORS = {
  fuel: '#0ea5e9',
  hospital: '#ec4899',
  clinic: '#f0abfc',
  police: '#3b82f6',
  fire_station: '#8b5cf6',
  bus_station: '#14b8a6',
  railway_station: '#6366f1',
  aerodrome: '#06b6d4',
  industrial: '#94a3b8',
};

export const FALLBACK_COLOR = '#64748b';
export const OWN_POINT_COLOR = '#a855f7';

/**
 * Glyph paths on a 24x24 grid. Deliberately simple: at ~20px on screen a
 * detailed icon is mud, and a recognisable silhouette is all that reads.
 */
const GLYPHS = {
  fuel: 'M6 3h7a1 1 0 0 1 1 1v16H5V4a1 1 0 0 1 1-1zm1 3v4h5V6H7zm9 3l2 2v6a1.5 1.5 0 0 0 3 0v-7l-3-3-2 2z',
  hospital: 'M10 3h4v5h5v4h-5v5h-4v-5H5V8h5V3z',
  clinic: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-1.5 4h3v3h3v3h-3v3h-3v-3h-3v-3h3V7z',
  police: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3zm0 5l-1.5 3.5L7 11l3 2-1 4 3-2 3 2-1-4 3-2-3.5-.5L12 7z',
  fire_station: 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1.5-.7-2.4-.7-2.4S16 11 16 13a4 4 0 0 1-8 0c0-5 4-6 4-11z',
  bus_station: 'M5 6a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v9a2 2 0 0 1-1 1.7V19h-3v-2H9v2H6v-2.3A2 2 0 0 1 5 15V6zm2 2v4h10V8H7zm1 6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm8 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  railway_station: 'M6 5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3l2 3h-2.5l-1.5-2.5h-5L6.5 20H4l2-3a3 3 0 0 1-3-3V5h3zm2 2v4h8V7H8zm1 6.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zm6 0a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z',
  aerodrome: 'M21 15v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8l-8 5v2l8-2.5V17l-2.5 2v1.5L12 19.5l3.5 1V19L13 17v-4.5L21 15z',
  industrial: 'M3 21V11l5 3V11l5 3V11l5 3V6h3v15H3zm3-4v2h3v-2H6zm5 0v2h3v-2h-3z',
  warehouse: 'M3 10l9-6 9 6v11h-5v-7H8v7H3V10z',
  own: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z',
  // Used for any category the palette does not know about.
  generic: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 4.5A2.5 2.5 0 1 1 12 11a2.5 2.5 0 0 1 0-4.5z',
};

const SIZE = 22;         // logical px
const PIXEL_RATIO = 2;   // draw at 2x so it stays crisp on retina

/**
 * Draw one badge: a filled rounded disc with a white glyph on it, plus a light
 * outer ring so it stays visible against both dark basemaps and dense areas.
 *
 * @param {string} color - badge fill
 * @param {string} glyphKey - key into GLYPHS
 * @returns {ImageData}
 */
function drawIcon(color, glyphKey) {
  const px = SIZE * PIXEL_RATIO;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');

  const c = px / 2;
  const r = c - PIXEL_RATIO;

  // Outer ring first, so the badge reads against any background.
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, r - 1.5 * PIXEL_RATIO, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const path = GLYPHS[glyphKey];
  if (path) {
    // Glyphs are authored on a 24x24 grid; scale to ~60% of the badge.
    const scale = (px * 0.58) / 24;
    ctx.save();
    ctx.translate(c - (24 * scale) / 2, c - (24 * scale) / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fill(new Path2D(path));
    ctx.restore();
  }

  return ctx.getImageData(0, 0, px, px);
}

/** Image id for an OSM category badge. */
export const categoryIconId = (cat) => `wag-poi-${cat}`;
/** Image id for a warehouse badge in a given availability state. */
export const warehouseIconId = (state) => `wag-warehouse-${state}`;
export const OWN_ICON_ID = 'wag-own-point';

/** Colour for a category, falling back for anything not in the palette. */
export const colorForCategory = (cat) => CATEGORY_COLORS[cat] || FALLBACK_COLOR;

/** Glyph for a category — the generic marker when we have no specific one. */
export const glyphForCategory = (cat) => (GLYPHS[cat] ? cat : 'generic');

/**
 * Ensure a badge exists for one category, drawing it on demand.
 *
 * Categories come from the database, not from this file, so the palette here is
 * a set of preferences rather than an allow-list: an imported category we have
 * never seen still gets a usable grey badge instead of silently having no layer
 * to toggle.
 *
 * @param {import('mapbox-gl').Map} map
 * @param {string} cat
 * @returns {string} the image id to reference from a layer
 */
export function ensureCategoryIcon(map, cat) {
  const id = categoryIconId(cat);
  if (!map.hasImage(id)) {
    map.addImage(id, drawIcon(colorForCategory(cat), glyphForCategory(cat)), { pixelRatio: PIXEL_RATIO });
  }
  return id;
}

/**
 * Register the fixed icons (warehouses, our own points) plus a badge for every
 * category in the built-in palette. Safe to call repeatedly — existing images
 * are skipped so a style reload does not throw.
 *
 * @param {import('mapbox-gl').Map} map
 */
export function registerMapIcons(map) {
  const add = (id, imageData) => {
    if (map.hasImage(id)) return;
    map.addImage(id, imageData, { pixelRatio: PIXEL_RATIO });
  };

  for (const cat of Object.keys(CATEGORY_COLORS)) ensureCategoryIcon(map, cat);

  // Three pre-rendered warehouse badges rather than a data-driven colour: an
  // icon image cannot be tinted per feature, so availability is selected with a
  // `match` on icon-image instead.
  for (const [state, color] of Object.entries(AVAILABILITY_COLORS)) {
    add(warehouseIconId(state), drawIcon(color, 'warehouse'));
  }

  add(OWN_ICON_ID, drawIcon(OWN_POINT_COLOR, 'own'));
}

/**
 * The same badge as an inline SVG, for the sidebar legend. The legend must show
 * the glyph the map draws — a plain colour dot next to "Fuel" leaves the reader
 * matching colours across two palettes, which is the confusion this whole change
 * exists to remove.
 *
 * @param {string} color
 * @param {string} glyphKey
 * @param {number} size
 * @returns {string} SVG markup
 */
export function iconSvg(color, glyphKey, size = 18) {
  const path = GLYPHS[glyphKey] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11.5" fill="rgba(255,255,255,0.95)"/>
    <circle cx="12" cy="12" r="10" fill="${color}"/>
    <g transform="translate(4.8 4.8) scale(0.6)"><path d="${path}" fill="#fff"/></g>
  </svg>`;
}

/** fire_station -> Fire Station */
export const humaniseCategory = (s) =>
  String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Availability strings are free text — "Yes", "yes", "Immediate", "From August",
 * "Ready to Occupie". Anything that clearly reads as ready counts as available;
 * an explicit no counts as unavailable; everything else is unknown rather than
 * being quietly bucketed as one or the other.
 */
export const availabilityExpression = [
  'let', 'a', ['downcase', ['to-string', ['coalesce', ['get', 'availability'], '']]],
  [
    'case',
    ['any',
      ['==', ['var', 'a'], 'yes'],
      ['in', 'immediate', ['var', 'a']],
      ['in', 'ready', ['var', 'a']],
      ['in', 'available', ['var', 'a']],
    ], 'available',
    ['==', ['var', 'a'], 'no'], 'unavailable',
    'unknown',
  ],
];
