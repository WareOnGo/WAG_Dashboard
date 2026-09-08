import { describe, it, expect } from 'vitest';
import {
  esc, availabilityBucket, warehousePopupHTML, osmPopupHTML, ownPopupHTML,
} from '../geoPopups';

describe('esc', () => {
  it('neutralises every character that could break out of markup', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('a"b\'c&d')).toBe('a&quot;b&#39;c&amp;d');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('popup escaping', () => {
  // Names come from OpenStreetMap and notes from our own users; both reach
  // innerHTML, so neither can be trusted.
  const payload = '<img src=x onerror="alert(1)">';

  it('escapes an OSM name', () => {
    const html = osmPopupHTML({ name: payload, category: 'fuel' });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('escapes every user-supplied field on our own points', () => {
    const html = ownPopupHTML({
      id: payload, name: payload, category: payload, notes: payload, createdBy: payload,
    }, true);
    // The decisive check — no executable attribute survives anywhere, including
    // in the id interpolated into the menu's data attributes.
    expect(html).not.toMatch(/onerror\s*=\s*"/i);
    expect(html).not.toMatch(/<img/i);
    // Case-insensitive: humaniseCategory title-cases the category before it is
    // escaped, so the payload's own casing is not preserved.
    expect(html.match(/&lt;img src=x/gi).length).toBeGreaterThanOrEqual(4);
  });

  it('escapes warehouse fields', () => {
    const html = warehousePopupHTML({ id: 1, city: payload, warehouseType: payload, availability: 'Yes' });
    expect(html).not.toContain('<img src=x');
  });
});

describe('availabilityBucket', () => {
  it.each([
    ['Yes', 'available'],
    ['yes', 'available'],
    ['Immediate', 'available'],
    ['Ready to occupy', 'available'],
    ['Available', 'available'],
    ['No', 'unavailable'],
    ['From September', 'unknown'],
    ['Under construction', 'unknown'],
    [null, 'unknown'],
  ])('buckets %s as %s', (input, expected) => {
    expect(availabilityBucket(input)).toBe(expected);
  });
});

describe('warehousePopupHTML lazy rendering', () => {
  const summary = { id: 1141, city: 'Bengaluru', warehouseType: 'PEB', availability: 'Yes' };

  it('renders from the summary alone, with skeletons where the rest will go', () => {
    const html = warehousePopupHTML(summary);
    expect(html).toContain('Warehouse #1141');
    expect(html).toContain('Bengaluru');
    // Labels are present so the layout is already its final shape; only the
    // values are pending.
    expect(html).toContain('Space');
    expect(html).toContain('Rate');
    expect(html.match(/geo-skel/g).length).toBeGreaterThanOrEqual(4);
    // Nothing is claimed until the record actually arrives.
    expect(html).not.toContain('sqft');
  });

  it('adds space, rate, owner and an image once the record arrives', () => {
    const html = warehousePopupHTML(summary, {
      ...summary,
      totalSpaceSqft: [10000, 5000],
      ratePerSqft: '25',
      warehouseOwnerType: 'Owner',
      media: { images: ['https://cdn/a.jpg'], videos: [], docs: [] },
    });
    expect(html).toContain('15,000 sqft');   // array form is summed
    expect(html).toContain('25/sqft');
    expect(html).toContain('Owner');
    expect(html).toContain('https://cdn/a.jpg');
    // Skeletons are gone once the values are real.
    expect(html).not.toContain('geo-skel');
  });

  it('says so when the detail fetch failed, rather than shimmering forever', () => {
    const html = warehousePopupHTML(summary, null, true);
    expect(html).toContain('Details unavailable');
    expect(html).not.toContain('geo-skel');
  });

  it('still shows the summary and the button when detail is unavailable', () => {
    const html = warehousePopupHTML(summary, null, true);
    expect(html).toContain('Bengaluru');
    expect(html).toContain('data-action="open-warehouse"');
  });
});

describe('ownPopupHTML menu', () => {
  const point = { id: 'p1', name: 'Depot', category: 'icd', createdBy: 'alice@wareongo.com' };

  it('offers edit, move and delete when the viewer may change the point', () => {
    const html = ownPopupHTML(point, true);
    expect(html).toContain('data-action="edit-point"');
    expect(html).toContain('data-action="move-point"');
    expect(html).toContain('data-action="delete-point"');
  });

  it('hides every mutating action otherwise', () => {
    // Presentation only — the API refuses these regardless of what is rendered.
    const html = ownPopupHTML(point, false);
    expect(html).not.toContain('data-action="edit-point"');
    expect(html).not.toContain('data-action="move-point"');
    expect(html).not.toContain('data-action="delete-point"');
    // The point itself is still readable.
    expect(html).toContain('Depot');
  });

  it('no longer shows a city, which is no longer collected', () => {
    expect(ownPopupHTML({ ...point, city: 'Bengaluru' }, true)).not.toContain('Bengaluru');
  });
});
