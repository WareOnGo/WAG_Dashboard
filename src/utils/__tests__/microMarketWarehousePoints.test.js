import { describe, expect, it, vi } from 'vitest';
import { warehousesForCitySuggestion } from '../microMarketWarehousePoints';

const polygon = { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [78, 13], [77, 13], [77, 12]]] };
const point = (id, city = 'Bengaluru') => ({ type: 'Feature', properties: { id, city }, geometry: { type: 'Point', coordinates: [77.5, 12.5] } });
const fc = (features = [], truncated = false) => ({ type: 'FeatureCollection', features, truncated });

describe('warehouse points for the existing polygon city suggestion', () => {
  it('queries just the drawn bounding box and returns lean candidates', async () => {
    const fetchPoints = vi.fn().mockResolvedValue(fc([point(1)]));
    const rows = await warehousesForCitySuggestion(polygon, { fetchPoints });
    expect(fetchPoints).toHaveBeenCalledExactlyOnceWith({ bbox: '77,12,78,13', limit: 2000, afterId: undefined, signal: undefined });
    expect(rows).toEqual([{ id: 1, city: 'Bengaluru', longitude: 77.5, latitude: 12.5 }]);
  });
  it('includes every page, so capped pins cannot change the majority city', async () => {
    const fetchPoints = vi.fn().mockResolvedValueOnce(fc([point(1, 'Other')], true))
      .mockResolvedValueOnce(fc([point(2), point(3)]));
    expect((await warehousesForCitySuggestion(polygon, { fetchPoints })).map(row => row.city)).toEqual(['Other', 'Bengaluru', 'Bengaluru']);
    expect(fetchPoints.mock.calls[1][0]).toMatchObject({ bbox: '77,12,78,13', afterId: 1 });
  });
  it('splits large bounds within the GIS limit and deduplicates shared edges', async () => {
    const geometry = { type: 'Polygon', coordinates: [[[0, 0], [40, 0], [40, 40], [0, 40], [0, 0]]] };
    const fetchPoints = vi.fn().mockResolvedValue(fc([point(1)]));
    expect(await warehousesForCitySuggestion(geometry, { fetchPoints })).toHaveLength(1);
    expect(fetchPoints.mock.calls.map(([args]) => args.bbox)).toEqual(['0,0,30,30', '0,30,30,40', '30,0,40,30', '30,30,40,40']);
  });
  it('stops a non-advancing capped response instead of silently using an incomplete set', async () => {
    const fetchPoints = vi.fn().mockResolvedValue(fc([point(1)], true));
    await expect(warehousesForCitySuggestion(polygon, { fetchPoints })).rejects.toThrow('cursor did not advance');
    expect(fetchPoints).toHaveBeenCalledTimes(2);
  });
  it('aborts before further requests when the page is closed', async () => {
    const controller = new AbortController();
    const fetchPoints = vi.fn().mockImplementation(async () => { controller.abort(); return fc([point(1)], true); });
    await expect(warehousesForCitySuggestion(polygon, { fetchPoints, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchPoints).toHaveBeenCalledTimes(1);
  });
});
