import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MicroMarkets from '../MicroMarkets';
import { geoService } from '../../services/geoService';
import { microMarketService } from '../../services/microMarketService';

const fixture = vi.hoisted(() => ({
  polygon: { type: 'Feature', id: 'new-area', properties: {}, geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [77, 13], [77, 12]]] } },
  message: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock('../MicroMarketMap', () => ({ default: props => <button onClick={() => props.onCreate(fixture.polygon)}>Draw area</button> }));
vi.mock('../../contexts', () => ({ useAuth: () => ({ user: { isAdmin: true } }) }));
vi.mock('antd', async original => ({ ...await original(), App: { useApp: () => ({ message: fixture.message }) } }));
vi.mock('../../services/geoService', () => ({ geoService: { warehouses: vi.fn() } }));
vi.mock('../../services/microMarketService', () => ({ microMarketService: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }));
const point = (id, city, coords) => ({ type: 'Feature', properties: { id, city }, geometry: { type: 'Point', coordinates: coords } });

beforeEach(() => {
  microMarketService.list.mockResolvedValue({ type: 'FeatureCollection', features: [] });
  microMarketService.create.mockReset().mockResolvedValue({ id: 'new-area', properties: {} });
  geoService.warehouses.mockReset(); fixture.message.warning.mockClear();
});

describe('micro-market drawing keeps its existing city and geometry behavior', () => {
  it('infers the city only from points inside the polygon and sends the original geometry', async () => {
    geoService.warehouses.mockResolvedValue({ type: 'FeatureCollection', features: [
      point(1, 'Bengaluru', [77.1, 12.1]), point(2, 'Bengaluru', [77.2, 12.1]),
      point(3, 'Other', [77.9, 12.9]), point(4, 'Other', [77.8, 12.9]), point(5, 'Other', [77.9, 12.8]),
    ] });
    render(<MicroMarkets />);
    expect(geoService.warehouses).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    await waitFor(() => expect(microMarketService.create).toHaveBeenCalledWith({ id: 'new-area', name: '', city: 'Bengaluru', geometry: fixture.polygon.geometry }));
    expect(geoService.warehouses).toHaveBeenCalledWith(expect.objectContaining({ bbox: '77,12,78,13', limit: 2000 }));
  });
  it('still saves the polygon when the optional city lookup fails', async () => {
    geoService.warehouses.mockRejectedValue(new Error('offline'));
    render(<MicroMarkets />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    await waitFor(() => expect(microMarketService.create).toHaveBeenCalledWith({ id: 'new-area', name: '', city: '', geometry: fixture.polygon.geometry }));
    expect(fixture.message.warning).toHaveBeenCalledTimes(1);
  });
  it('cancels an unfinished city lookup when leaving the mapper', async () => {
    let resolve;
    geoService.warehouses.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { unmount } = render(<MicroMarkets />);
    fireEvent.click(screen.getByRole('button', { name: 'Draw area' }));
    const { signal } = geoService.warehouses.mock.calls[0][0];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ type: 'FeatureCollection', features: [] }));
    expect(microMarketService.create).not.toHaveBeenCalled();
  });
});
