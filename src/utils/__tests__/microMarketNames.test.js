import { describe, expect, it } from 'vitest';
import { getMicroMarketDisplayNames } from '../microMarketNames';

const DRAW_ID = 'aB3dE6gH9jK2mN5pQ8sT1vW4yZ7cF0iL';
const HEX_ID = 'a1b2c3d4e5f67890abcdef0123456789';
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('getMicroMarketDisplayNames', () => {
  it('keeps names and removes unnamed polygon IDs from mixed tags', () => {
    const tags = [DRAW_ID, ' HSR ', HEX_ID, 'Kudlu Gate', UUID, 'HSR'];
    const original = [...tags];
    expect(getMicroMarketDisplayNames(tags)).toEqual(['HSR', 'Kudlu Gate']);
    expect(tags).toEqual(original);
  });

  it('leaves no chips when every tag is a polygon ID', () => {
    expect(getMicroMarketDisplayNames([DRAW_ID, HEX_ID.toUpperCase(), ` ${UUID.toUpperCase()} `])).toEqual([]);
  });

  it('preserves short, numbered, punctuated, non-Latin, and long place names', () => {
    const names = ['HSR', 'Sector 37', 'NH48', 'T Begur', 'Bhiwandi–Kalyan Belt', 'Sidlaghatta Road/Ekarajapura', 'ಬೇಗೂರು', 'Nelamangala Logistics and Industrial Corridor'];
    expect(getMicroMarketDisplayNames(names)).toEqual(names);
  });

  it('supports a single stored name while filtering a single stored ID', () => {
    expect(getMicroMarketDisplayNames(' Nelamangala ')).toEqual(['Nelamangala']);
    expect(getMicroMarketDisplayNames(DRAW_ID)).toEqual([]);
    expect(getMicroMarketDisplayNames(UUID)).toEqual([]);
  });

  it.each([undefined, null, '', ' ', [], 42, { name: 'Invalid shape' }])('omits missing or invalid values: %j', value => {
    expect(getMicroMarketDisplayNames(value)).toEqual([]);
  });

  it('ignores invalid entries and blanks in a partially populated array', () => {
    expect(getMicroMarketDisplayNames([null, 42, {}, '', ' ', ' Whitefield ', 'Whitefield'])).toEqual(['Whitefield']);
  });
});
