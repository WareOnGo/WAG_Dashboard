import { describe, it, expect } from 'vitest';
import {
  CATEGORY_COLORS,
  AVAILABILITY_COLORS,
  FALLBACK_COLOR,
  colorForCategory,
  glyphForCategory,
  categoryIconId,
  warehouseIconId,
  iconSvg,
  humaniseCategory,
} from '../geoIcons';

describe('category colour/glyph resolution', () => {
  it('uses the palette for a known category', () => {
    expect(colorForCategory('fuel')).toBe(CATEGORY_COLORS.fuel);
    expect(glyphForCategory('fuel')).toBe('fuel');
  });

  it('falls back for a category the palette has never seen', () => {
    // Categories come from the database, so this is the normal case for
    // anything a future import adds — it must still get a usable badge rather
    // than an empty one, or the sidebar shows a toggle that does nothing.
    expect(colorForCategory('cold_storage')).toBe(FALLBACK_COLOR);
    expect(glyphForCategory('cold_storage')).toBe('generic');
  });

  it('never lets a category colour collide with an availability colour', () => {
    // Colour means STATUS for warehouses and CATEGORY for POIs. If the two
    // palettes overlap, a pink hospital reads as an unavailable warehouse.
    const availability = Object.values(AVAILABILITY_COLORS);
    for (const [cat, color] of Object.entries(CATEGORY_COLORS)) {
      expect(availability, `${cat} reuses an availability colour`).not.toContain(color);
    }
  });
});

describe('image ids', () => {
  it('namespaces ids so they cannot clash with the style sprite', () => {
    expect(categoryIconId('fuel')).toBe('wag-poi-fuel');
    expect(warehouseIconId('available')).toBe('wag-warehouse-available');
  });
});

describe('iconSvg', () => {
  it('renders the badge colour and a glyph path', () => {
    const svg = iconSvg('#0ea5e9', 'fuel');
    expect(svg).toContain('#0ea5e9');
    expect(svg).toMatch(/<path d="M/);
  });

  it('still renders a badge for an unknown glyph key', () => {
    // The legend must not blow up on a category added by an import.
    const svg = iconSvg('#64748b', 'not_a_real_glyph');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#64748b');
  });
});

describe('humaniseCategory', () => {
  it('turns an OSM tag into a label', () => {
    expect(humaniseCategory('fire_station')).toBe('Fire Station');
    expect(humaniseCategory('fuel')).toBe('Fuel');
  });
});
