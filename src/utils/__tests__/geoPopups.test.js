import { describe, it, expect } from 'vitest';
import {
  esc, availabilityBucket, warehousePopupHTML, osmPopupHTML, ownPopupHTML, newPointFormHTML,
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
      id: 'x', name: payload, category: payload, city: payload, notes: payload, createdBy: payload,
    });
    // Case-insensitive: humaniseCategory title-cases the category before it is
    // escaped, so the payload's own casing is not preserved.
    expect(html.match(/&lt;img src=x/gi)).toHaveLength(5);
    // The decisive check — no executable attribute survives anywhere.
    expect(html).not.toMatch(/onerror\s*=\s*"/i);
    expect(html).not.toMatch(/<img/i);
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

describe('newPointFormHTML', () => {
  it('carries the clicked coordinates and the fields the API requires', () => {
    const html = newPointFormHTML(12.95, 77.61);
    expect(html).toContain('12.95000, 77.61000');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="category"');
    expect(html).toContain('required');
  });
});
