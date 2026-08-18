import { AVAILABILITY_COLORS, colorForCategory, glyphForCategory, iconSvg, humaniseCategory } from './geoIcons';
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

/** Popup for one of our own points, with a delete action. */
export const ownPopupHTML = (p) => `
  <div style="${SHELL}">
    ${header(iconSvg('#a855f7', 'own', 20), esc(p.name), '')}
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div><div style="${LABEL}">Category</div><div style="${VALUE}">${esc(humaniseCategory(p.category))}</div></div>
      ${p.city ? `<div><div style="${LABEL}">City</div><div style="${VALUE}">${esc(p.city)}</div></div>` : ''}
      ${p.notes ? `<div><div style="${LABEL}">Notes</div><div style="${VALUE}line-height:1.4;">${esc(p.notes)}</div></div>` : ''}
      ${p.createdBy ? `<div><div style="${LABEL}">Added by</div><div style="${VALUE}">${esc(p.createdBy)}</div></div>` : ''}
    </div>
    <div style="${DIVIDER}">
      <button data-action="delete-point" data-id="${esc(p.id)}"
        style="width:100%;padding:7px;font-size:12px;font-weight:500;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);border-radius:4px;cursor:pointer;">
        Delete point
      </button>
    </div>
  </div>`;

/**
 * Inline "add a point" form, rendered at the clicked location.
 *
 * A form in a popup rather than a centred dialog keeps the pin you are naming
 * on screen while you name it.
 */
export const newPointFormHTML = (lat, lng) => `
  <form data-form="new-point" style="${SHELL}">
    <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:2px;">Add point</div>
    <div style="font-size:10px;color:rgba(255,255,255,0.45);margin-bottom:10px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <input name="name" placeholder="Name" required autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:7px 8px;font-size:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;" />
      <input name="category" placeholder="Category (e.g. logistics_node)" required autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:7px 8px;font-size:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;" />
      <input name="city" placeholder="City (optional)" autocomplete="off"
        style="width:100%;box-sizing:border-box;padding:7px 8px;font-size:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;" />
      <textarea name="notes" placeholder="Notes (optional)" rows="2"
        style="width:100%;box-sizing:border-box;padding:7px 8px;font-size:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:4px;color:#fff;resize:vertical;font-family:inherit;"></textarea>
    </div>
    <div data-role="error" style="display:none;font-size:11px;color:#ef4444;margin-top:8px;"></div>
    <div style="display:flex;gap:6px;${DIVIDER}">
      <button type="button" data-action="cancel-point"
        style="flex:1;padding:7px;font-size:12px;background:rgba(255,255,255,0.12);color:#fff;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
      <button type="submit" data-action="save-point"
        style="flex:1;padding:7px;font-size:12px;font-weight:500;background:#1890ff;color:#fff;border:none;border-radius:4px;cursor:pointer;">Save</button>
    </div>
  </form>`;
