import {
  AVAILABILITY_COLORS, colorForCategory, glyphForCategory, iconSvg, humaniseCategory,
  OWN_POINT_COLOR, POI_CATEGORIES, poiCategoryLabel, poiCategoryGlyph,
} from './geoIcons';
import { getMediaFromWarehouse } from './mediaUtils';

/**
 * HTML builders for the on-map popups.
 *
 * Popups are used instead of a centred modal so the map stays visible and
 * usable: inspecting a point should not hide the surrounding context, which is
 * the whole reason for looking at a map.
 *
 * Everything interpolated here is escaped. POI names come from OpenStreetMap
 * and notes come from our own users, so both are untrusted input heading into
 * innerHTML.
 */

/** Escape a value for interpolation into HTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const SHELL = 'font-family:Verdana,Geneva,sans-serif;background:rgba(26,26,26,0.98);color:rgba(255,255,255,0.95);border-radius:6px;padding:12px;min-width:200px;max-width:280px;';
const LABEL = 'font-size:10px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;';
const VALUE = 'font-size:13px;color:#fff;';
const DIVIDER = 'border-top:1px solid rgba(255,255,255,0.15);margin-top:10px;padding-top:10px;';

const header = (iconHtml, title, badge) => `
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <span style="flex:0 0 auto;display:flex;">${iconHtml}</span>
    <span style="flex:1;font-size:14px;font-weight:600;color:#fff;line-height:1.25;">${title}</span>
    ${badge || ''}
  </div>`;

/** Which availability bucket a free-text value falls into (mirrors the map expression). */
export const availabilityBucket = (v) => {
  const a = String(v ?? '').toLowerCase();
  if (a === 'yes' || a.includes('immediate') || a.includes('ready') || a.includes('available')) return 'available';
  if (a === 'no') return 'unavailable';
  return 'unknown';
};

/** Total offered space, summing the array form the column uses. */
const formatSpace = (space) => {
  if (!space) return '—';
  if (Array.isArray(space)) return space.reduce((sum, v) => sum + (Number(v) || 0), 0).toLocaleString('en-IN');
  return Number(space).toLocaleString('en-IN');
};

const cell = (label, value) => `<div><div style="${LABEL}">${label}</div><div style="${VALUE}">${value}</div></div>`;

/**
 * Popup for a warehouse pin.
 *
 * Renders in two passes. The viewport endpoint deliberately returns only what a
 * dot needs (id, city, type, availability), so the popup opens instantly from
 * that and fills in image, space, rate and owner type once the full record has
 * been fetched. Detail is therefore loaded only for pins actually clicked,
 * rather than for every pin in view.
 *
 * @param {Object} p - properties carried on the map feature
 * @param {Object|null} full - the complete warehouse record, once available
 * @param {boolean} failed - true when the detail fetch failed
 */
export const warehousePopupHTML = (p, full = null, failed = false) => {
  const bucket = availabilityBucket(full?.availability ?? p.availability);
  const badge = `<span style="flex:0 0 auto;font-size:10px;padding:3px 7px;border-radius:4px;font-weight:600;background:${AVAILABILITY_COLORS[bucket]};color:#0b0b0b;">${esc(full?.availability ?? p.availability ?? 'Unknown')}</span>`;

  const image = full ? getMediaFromWarehouse(full).images?.[0] : null;

  // The skeleton occupies exactly the height the image will, so the popup does
  // not resize when the photo arrives.
  let imageHtml;
  if (full) {
    imageHtml = image
      ? `<img src="${esc(image)}" alt="" loading="lazy" crossorigin="anonymous" class="geo-reveal"
           style="width:100%;height:80px;object-fit:cover;border-radius:4px;margin-bottom:10px;"
           onerror="this.style.display='none'" />`
      : '';
  } else if (failed) {
    imageHtml = '';
  } else {
    imageHtml = `<div class="geo-skel" style="width:100%;height:80px;margin-bottom:10px;"></div>`;
  }

  /** A label with a shimmering bar where its value will be. */
  const skelCell = (label, width) => `
    <div>
      <div style="${LABEL}">${label}</div>
      <div class="geo-skel" style="height:13px;width:${width};margin-top:3px;"></div>
    </div>`;

  const pending = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
        ${skelCell('Space', '80%')}
        ${skelCell('Rate', '65%')}
      </div>
      <div style="margin-top:10px;">${skelCell('Owner', '55%')}</div>`;

  const unavailable = `
      <div style="${LABEL}margin-top:10px;color:rgba(255,255,255,0.4);">
        Details unavailable
      </div>`;

  let extra;
  if (full) {
    extra = `
      <div class="geo-reveal">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          ${cell('Space', `${formatSpace(full.totalSpaceSqft)} sqft`)}
          ${cell('Rate', full.ratePerSqft ? `₹${esc(full.ratePerSqft)}/sqft` : '—')}
        </div>
        <div style="margin-top:10px;">
          ${cell('Owner', esc(full.warehouseOwnerType || '—'))}
        </div>
      </div>`;
  } else {
    extra = failed ? unavailable : pending;
  }

  return `
    <div style="${SHELL}">
      ${header(iconSvg(AVAILABILITY_COLORS[bucket], 'warehouse', 20), `Warehouse #${esc(p.id)}`, badge)}
      ${imageHtml}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${cell('City', esc(full?.city ?? p.city ?? '—'))}
        ${cell('Type', esc(full?.warehouseType ?? p.warehouseType ?? '—'))}
      </div>
      ${extra}
      <div style="${DIVIDER}">
        <button data-action="open-warehouse" data-id="${esc(p.id)}"
          style="width:100%;padding:7px;font-size:12px;font-weight:500;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">
          Open details
        </button>
      </div>
    </div>`;
};

/** Popup for an imported OSM point. */
export const osmPopupHTML = (p) => `
  <div style="${SHELL}">
    ${header(iconSvg(colorForCategory(p.category), glyphForCategory(p.category), 20), esc(p.name || humaniseCategory(p.category)), '')}
    <div><div style="${LABEL}">Category</div><div style="${VALUE}">${esc(humaniseCategory(p.category))}</div></div>
    <div style="${DIVIDER}font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;">
      From OpenStreetMap. Corrections belong upstream — or add our own point here instead.
    </div>
  </div>`;

const MENU_ITEM = 'display:block;width:100%;text-align:left;padding:7px 10px;font-size:12px;background:transparent;color:#fff;border:none;cursor:pointer;font-family:inherit;';

/**
 * Popup for one of our own points.
 *
 * Edit/move/delete live behind a kebab menu rather than sitting as three
 * buttons: viewing a point is the common case, and destructive actions should
 * take a deliberate extra step rather than being one stray click away.
 *
 * `canEdit` only hides the menu. The server independently refuses a mutation
 * from anyone but the author (or an admin), because a hidden button stops
 * nobody from calling the endpoint.
 */
export const ownPopupHTML = (p, canEdit = false) => `
  <div style="${SHELL}position:relative;">
    ${canEdit ? `
      <button data-action="toggle-menu" aria-label="Point actions"
        style="position:absolute;top:8px;right:8px;width:24px;height:24px;line-height:1;padding:0;font-size:16px;background:transparent;color:rgba(255,255,255,0.6);border:none;border-radius:4px;cursor:pointer;">⋯</button>
      <div data-role="menu" style="display:none;position:absolute;top:32px;right:8px;z-index:2;min-width:130px;background:#242424;border:1px solid rgba(255,255,255,0.15);border-radius:5px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
        <button data-action="edit-point" data-id="${esc(p.id)}" style="${MENU_ITEM}">Edit details</button>
        <button data-action="move-point" data-id="${esc(p.id)}" style="${MENU_ITEM}">Move on map</button>
        <button data-action="delete-point" data-id="${esc(p.id)}" style="${MENU_ITEM}color:#ef4444;border-top:1px solid rgba(255,255,255,0.1);">Delete</button>
      </div>` : ''}
    ${header(iconSvg(OWN_POINT_COLOR, poiCategoryGlyph(p.category), 20), esc(p.name), '')}
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div><div style="${LABEL}">Type</div><div style="${VALUE}">${esc(poiCategoryLabel(p.category))}</div></div>
      ${p.notes ? `<div><div style="${LABEL}">Notes</div><div style="${VALUE}line-height:1.4;">${esc(p.notes)}</div></div>` : ''}
      ${p.createdBy ? `<div><div style="${LABEL}">Added by</div><div style="${VALUE}">${esc(p.createdBy)}</div></div>` : ''}
    </div>
  </div>`;

// Move mode has no popup: it uses a toolbar pinned to the bottom of the map
// (see GeoExplorerMap.startMove and .geo-move-bar), because a panel anchored to
// the point covers the ground the user is aiming at.

const INPUT = 'width:100%;box-sizing:border-box;padding:7px 8px;font-size:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;';

// The style string is interpolated into a double-quoted HTML attribute, so it
// must stay free of quote characters — which rules out a `url("data:...")`
// custom arrow. The native arrow follows the select's `color`, so it reads white
// on this dark popup anyway.
const SELECT = 'cursor:pointer;';

// Options are painted by the OS on Linux/Windows and would otherwise inherit a
// white background with the select's white text.
const OPTION = 'background:#242424;color:#fff;';

// A point created before this list existed keeps its old category in the
// database and in the popup, but the form deliberately does NOT preselect it:
// the API only accepts the fixed codes now, so offering the stale value back
// would produce a form that cannot be saved. Editing such a point requires
// picking a real type, which is the migration.
/**
 * Point form, used for both creating and editing.
 *
 * A form in a popup rather than a centred dialog keeps the location you are
 * naming on screen while you name it.
 *
 * There is deliberately no city field: the point already carries coordinates, so
 * a city typed by hand is a second source of truth that can only disagree with
 * them. It is derivable by reverse geocoding whenever it is actually needed.
 *
 * @param {{lat:number,lng:number}} at - where the point sits
 * @param {Object|null} existing - populate for an edit; omit to create
 */
export const pointFormHTML = (at, existing = null) => {
  const editing = !!existing;
  return `
  <form data-form="point" ${editing ? `data-id="${esc(existing.id)}"` : ''} style="${SHELL}">
    <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:2px;">${editing ? 'Edit point' : 'Add point'}</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:10px;">${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <input name="name" placeholder="Name" required autocomplete="off"
        value="${esc(existing?.name ?? '')}" style="${INPUT}" />
      <select name="category" required style="${INPUT}${SELECT}">
        <option value="" disabled ${existing?.category ? '' : 'selected'} style="${OPTION}">Point type\u2026</option>
        ${POI_CATEGORIES.map((c) => `
          <option value="${esc(c.value)}" ${existing?.category === c.value ? 'selected' : ''} style="${OPTION}">${esc(c.label)}</option>`).join('')}
      </select>
      <textarea name="notes" placeholder="Notes (optional)" rows="2"
        style="${INPUT}resize:vertical;font-family:inherit;">${esc(existing?.notes ?? '')}</textarea>
    </div>
    <div data-role="error" style="display:none;font-size:11px;color:#ef4444;margin-top:8px;"></div>
    <div style="display:flex;gap:6px;${DIVIDER}">
      <button type="button" data-action="cancel-point"
        style="flex:1;padding:7px;font-size:12px;background:rgba(255,255,255,0.12);color:#fff;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
      <button type="submit" data-action="save-point"
        style="flex:1;padding:7px;font-size:12px;font-weight:500;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">Save</button>
    </div>
  </form>`;
};
