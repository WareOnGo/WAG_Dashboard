import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapView from '../MapView';
import { geoService } from '../../services/geoService';
import { warehouseService } from '../../services/warehouseService';

const world = vi.hoisted(() => ({ maps: [], popups: [] }));
vi.mock('mapbox-gl', () => {
  class Map {
    constructor(options) {
      this.options = options; this.events = {}; this.sources = {}; this.layers = [];
      this.canvas = document.createElement('canvas'); options.container.append(this.canvas);
      this.remove = vi.fn(); this.resize = vi.fn(); world.maps.push(this);
    }
    on(event, layer, handler) {
      const key = handler ? `${event}:${layer}` : event;
      (this.events[key] ||= []).push(handler || layer);
    }
    off(event, handler) { this.events[event] = this.events[event]?.filter(fn => fn !== handler); }
    emit(event, payload, layer) { this.events[layer ? `${event}:${layer}` : event]?.forEach(handler => handler(payload)); }
    addControl() {}
    getCanvas() { return this.canvas; }
    getBounds() { return { getWest: () => 77, getSouth: () => 12, getEast: () => 78, getNorth: () => 13 }; }
    addSource(id) { this.sources[id] = { setData: vi.fn() }; }
    getSource(id) { return this.sources[id]; }
    addLayer(layer) { this.layers.push(layer); }
  }
  class Popup {
    constructor(options) { this.options = options; this.events = {}; world.popups.push(this); }
    setLngLat(at) { this.at = at; return this; }
    setDOMContent(element) { this.element = element; return this; }
    addTo() { document.body.append(this.element); return this; }
    on(event, handler) { this.events[event] = handler; return this; }
    remove() { this.events.close?.(); this.element?.remove(); }
  }
  return { default: { Map, Popup, NavigationControl: class {} } };
});
vi.mock('../../utils/geoIcons', async importOriginal => ({ ...await importOriginal(), registerWarehouseIcons: vi.fn() }));
vi.mock('../../services/geoService', async importOriginal => ({ ...await importOriginal(), geoService: { warehouses: vi.fn() } }));
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getById: vi.fn() } }));
const empty = { type: 'FeatureCollection', features: [] };
const full = id => ({ id, warehouseType: 'PEB', city: 'Bengaluru', totalSpaceSqft: [10000], ratePerSqft: '25' });
const clickPin = (map, id) => act(() => map.emit('click', { features: [{ properties: { id }, geometry: { coordinates: [77.6, 12.95] } }] }, 'dashboard-warehouse-pins'));

beforeEach(async () => {
  world.maps.length = 0; world.popups.length = 0;
  const mapbox = (await import('mapbox-gl')).default;
  mapbox.accessToken = 'pk.test';
  geoService.warehouses.mockReset().mockResolvedValue(empty);
  warehouseService.getById.mockReset().mockImplementation(id => Promise.resolve(full(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
async function mount(props = {}) {
  const view = render(<MapView {...props} />);
  const map = world.maps.at(-1);
  await act(async () => map.emit('load'));
  return { ...view, map };
}

describe('dashboard warehouse map', () => {
  it('uses one warehouse source and layer, with no eager detail fetches', async () => {
    const { map } = await mount({ filters: { fireNoc: 'available' } });
    expect(Object.keys(map.sources)).toEqual(['dashboard-warehouses']);
    expect(map.layers.map(layer => layer.id)).toEqual(['dashboard-warehouse-pins']);
    expect(geoService.warehouses).toHaveBeenCalledWith(expect.objectContaining({ filters: { fireNoc: 'available' }, bbox: '76.600000,11.600000,78.400000,13.400000', limit: 2000 }));
    expect(warehouseService.getById).not.toHaveBeenCalled();
    expect(world.popups).toHaveLength(0);
  });
  it('fetches a clicked warehouse once and preserves View and Edit actions', async () => {
    const onViewDetails = vi.fn(), onEdit = vi.fn();
    const { map, unmount } = await mount({ onViewDetails, onEdit });
    clickPin(map, 42);
    fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
    expect(onViewDetails).toHaveBeenCalledWith(full(42));
    expect(onEdit).toHaveBeenCalledWith(full(42));
    clickPin(map, 42);
    await screen.findByRole('button', { name: 'View', exact: true });
    expect(warehouseService.getById).toHaveBeenCalledTimes(1);
    expect(window.warehouseMapActions).toBeUndefined();
    unmount();
    expect(screen.queryByText('#42')).not.toBeInTheDocument();
  });
  it('does not let a slow popup response replace a more recently clicked pin', async () => {
    let resolve;
    warehouseService.getById.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { map } = await mount();
    clickPin(map, 1);
    clickPin(map, 2);
    await screen.findByRole('button', { name: 'View', exact: true });
    await act(async () => resolve({ ...full(1), warehouseType: 'Old warehouse' }));
    expect(screen.queryByText('Old warehouse')).not.toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });
  it('retries failed details without falling back to an incomplete edit record', async () => {
    warehouseService.getById.mockRejectedValueOnce(new Error('offline'));
    const { map } = await mount();
    clickPin(map, 5);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: 'Edit', exact: true });
    expect(warehouseService.getById).toHaveBeenCalledTimes(2);
  });
  it('updates filters and mutations without recreating or moving the map', async () => {
    const { map, rerender } = await mount();
    rerender(<MapView filters={{ city: 'Chennai' }} />);
    await waitFor(() => expect(geoService.warehouses).toHaveBeenCalledTimes(2));
    const filters = { city: 'Chennai' };
    rerender(<MapView filters={filters} refreshKey={1} />);
    await waitFor(() => expect(geoService.warehouses).toHaveBeenCalledTimes(3));
    expect(world.maps).toHaveLength(1);
    expect(map.remove).not.toHaveBeenCalled();
  });
  it('closes stale details on a mutation and refetches them when reopened', async () => {
    const { map, rerender } = await mount();
    clickPin(map, 5);
    await screen.findByRole('button', { name: 'View', exact: true });
    rerender(<MapView refreshKey={1} />);
    expect(screen.queryByText('#5')).not.toBeInTheDocument();
    clickPin(map, 5);
    await screen.findByRole('button', { name: 'View', exact: true });
    expect(warehouseService.getById).toHaveBeenCalledTimes(2);
  });
  it('clears pins and stops viewport requests when access is disabled', async () => {
    const { map, rerender } = await mount();
    rerender(<MapView active={false} />);
    await act(async () => { map.emit('moveend'); await new Promise(resolve => setTimeout(resolve, 220)); });
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
    expect(map.getSource('dashboard-warehouses').setData).toHaveBeenLastCalledWith(empty);
    clickPin(map, 1);
    expect(warehouseService.getById).not.toHaveBeenCalled();
  });
});
