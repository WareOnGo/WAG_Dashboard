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
  // Categories added by the national OSM ingest. Thirteen cool hues cannot all
  // be told apart at 22px, so these four lean on the GLYPH for identity and use
  // colour only to group: metro sits in the same indigo family as the railway
  // because a commuter reads them as one network. Every badge is dark enough to
  // carry a white glyph — the reason the first pass at city_centre (sky-300) was
  // rejected, since a pale badge erases the very thing that names it.
  metro_station: '#4338ca',
  city_centre: '#1e3a8a',
  seaport: '#0369a1',
  highway_access: '#475569',
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
  // A letterform rather than a train: railway_station is already a carriage, and
  // at 22px two vehicle silhouettes are one silhouette.
  metro_station: 'M4 20V4h4l4 7.5L16 4h4v16h-3.6V10.2L12 17.6 7.6 10.2V20H4z',
  city_centre: 'M2 21V8l5-3 5 3v3h4l5 3v10H2zm3-9v2h2v-2H5zm0 5v2h2v-2H5zm4-5v2h2v-2H9zm0 5v2h2v-2H9zm7 0v2h2v-2h-2zm0-4v2h2v-2h-2z',
  seaport: 'M12 1.6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-1.3 5.5h2.6v1.6H16.4v2.6h-3.1v6.9c2.1-.6 3.7-2.2 4.2-4.2H15.9l3.05-4.6 3.05 4.6h-1.7c-.65 4.2-4 7.4-8.3 7.9-4.3-.5-7.65-3.7-8.3-7.9H2l3.05-4.6L8.1 14.4H6.4c.5 2 2.1 3.6 4.3 4.2v-6.9H7.6V9.1h3.1V7.1z',
  // Road in perspective with a dashed centre line. The dashes are carved by
  // winding direction, wound the opposite way to the outer trapezoid exactly as
  // industrial's windows are — same way up, and they fill in solid instead.
  highway_access: 'M10 3h4l6 18H4L10 3zM11.3 5.6v2.4h1.4V5.6zM11 9.4v2.7h2V9.4zM10.6 13.6v3.2h2.8v-3.2z',
  warehouse: 'M3 10l9-6 9 6v11h-5v-7H8v7H3V10z',
  own: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z',
  // Glyphs for our own point categories.
  client: 'M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 3h6V6H9v1z',
  food: 'M6 2v8a2 2 0 0 0 2 2v10h2V12a2 2 0 0 0 2-2V2h-1.5v6H9V2H7.5v6H6V2zm10 0c-1.5 0-2.5 2.5-2.5 6 0 2 .8 3.2 2 3.7V22h2V2h-1.5z',
  hotel: 'M3 6h2v7h6V8h6a3 3 0 0 1 3 3v9h-2v-3H5v3H3V6zm4 1.5A2.2 2.2 0 1 1 7 12a2.2 2.2 0 0 1 0-4.5z',
  quarters: 'M9 3l6 3v15h-4v-5H8v5H3V8l6-5zm8 5l4 2v11h-4V8zM5 9v2h2V9H5zm0 4v2h2v-2H5z',
  yard: 'M3 8h18v2H3V8zm0 6h18v2H3v-2zM5 4h2v16H5V4zm12 0h2v16h-2V4z',
  // Used for any category the palette does not know about.
  generic: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 4.5A2.5 2.5 0 1 1 12 11a2.5 2.5 0 0 1 0-4.5z',
};

/**
 * Categories for OUR OWN points of interest — a fixed list driven by a dropdown,
 * unlike the OSM categories which come from whatever the import contains.
 *
 * Codes are stored and labels live here, so renaming one is a string change
 * rather than an update across every row. The glyph varies per category while
 * the badge colour stays a single purple: colour says "this is ours", the glyph
 * says what it is, which keeps our points distinguishable from OSM reference
 * data at a glance.
 */
export const POI_CATEGORIES = [
  { value: 'POTENTIAL_CLIENT', label: 'Potential client', glyph: 'client' },
  { value: 'POTENTIAL_WAREHOUSE', label: 'Potential warehouse', glyph: 'warehouse' },
  { value: 'FOOD_PLACE', label: 'Good local food place', glyph: 'food' },
  { value: 'HOTEL_RESTAURANT', label: 'Good local hotel/restaurant', glyph: 'hotel' },
  { value: 'LABOR_QUARTERS', label: 'Residential quarters - labor', glyph: 'quarters' },
  { value: 'OPEN_YARD_BTS', label: 'Potential open yard/BTS site', glyph: 'yard' },
];

const POI_BY_VALUE = Object.fromEntries(POI_CATEGORIES.map((c) => [c.value, c]));

/**
 * Label for one of our point categories. Falls back to the humanised code so a
 * value written before this list existed still reads as something.
 */
export const poiCategoryLabel = (value) =>
  POI_BY_VALUE[value]?.label ?? humaniseCategory(value);

/** Glyph key for one of our point categories, defaulting to the star. */
export const poiCategoryGlyph = (value) => POI_BY_VALUE[value]?.glyph ?? 'own';

/** Image id for one of our point badges. */
export const poiIconId = (value) => `wag-own-${POI_BY_VALUE[value] ? value : 'DEFAULT'}`;

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

  // One badge per own-point category, all in the same purple, plus a starred
  // default for rows whose category predates the fixed list.
  add(poiIconId(null), drawIcon(OWN_POINT_COLOR, 'own'));
  for (const c of POI_CATEGORIES) {
    add(poiIconId(c.value), drawIcon(OWN_POINT_COLOR, c.glyph));
  }
}

/**
 * `icon-image` expression selecting the badge for one of our points. Icon images
 * cannot be tinted or swapped per feature by any other means, so the category is
 * resolved with a `match` the same way warehouse availability is.
 */
export const ownIconExpression = [
  'match', ['coalesce', ['get', 'category'], ''],
  ...POI_CATEGORIES.flatMap((c) => [c.value, poiIconId(c.value)]),
  poiIconId(null),
];

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

/**
 * The badge with a highlight ring around it, for the point being dragged in
 * move mode.
 *
 * The ring is drawn inside the SVG rather than as a CSS pseudo-element. A
 * pseudo-element sized with `inset` and `border-radius: 50%` depends on the
 * host element's box, and Mapbox owns the styling of marker elements — when the
 * box came out full-width the "circle" stretched into an ellipse spanning the
 * whole map. Drawing it here makes the ring geometry independent of any CSS.
 *
 * The viewBox is padded to 32 units so the ring has room outside the badge
 * without the badge itself shrinking relative to the map's other points.
 *
 * @param {string} color
 * @param {string} glyphKey
 * @param {number} size - rendered px, badge and ring together
 */
export function moveHandleSvg(color, glyphKey, size = 40) {
  const path = GLYPHS[glyphKey] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14.5" fill="none" stroke="rgba(0,0,0,0.45)" stroke-width="5"/>
    <circle cx="16" cy="16" r="14.5" fill="none" stroke="${OWN_POINT_COLOR}" stroke-width="3"/>
    <circle cx="16" cy="16" r="10.5" fill="rgba(255,255,255,0.95)"/>
    <circle cx="16" cy="16" r="9" fill="${color}"/>
    <g transform="translate(10.6 10.6) scale(0.45)"><path d="${path}" fill="#fff"/></g>
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
