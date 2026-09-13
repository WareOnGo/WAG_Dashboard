import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MapView from '../MapView';
import { geoService } from '../../services/geoService';
import { warehouseService } from '../../services/warehouseService';

const world = vi.hoisted(() => ({ maps: [], popups: [] }));
vi.mock('mapbox-gl', () => {
  class Map {
    constructor(options) {
      this.options = options; this.events = {}; this.sources = {}; this.layers = [];
      this.canvas = document.createElement('canvas'); options.container.append(this.canvas);
      this.remove = vi.fn(); this.resize = vi.fn(); this.stop = vi.fn(); world.maps.push(this);
      this.setStyle = vi.fn(() => { this.sources = {}; this.layers = []; });
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
    addSource(id, options) {
      const source = { data: options.data, setData: vi.fn(data => { source.data = data; }) };
      this.sources[id] = source;
    }
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
  return { default: { Map, Popup, NavigationControl: class {}, FullscreenControl: class {} } };
});
vi.mock('../../utils/geoIcons', async importOriginal => ({ ...await importOriginal(), registerWarehouseIcons: vi.fn() }));
vi.mock('../../services/geoService', async importOriginal => ({ ...await importOriginal(), geoService: { warehouses: vi.fn() } }));
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getById: vi.fn() } }));
const empty = { type: 'FeatureCollection', features: [] };
const full = id => ({ id, warehouseType: 'PEB', city: 'Bengaluru', totalSpaceSqft: [10000], ratePerSqft: '25' });
const clickPin = (map, id) => act(() => map.emit('click', { features: [{ properties: { id }, geometry: { coordinates: [77.6, 12.95] } }] }, 'dashboard-warehouse-pins'));
const fullscreenDescriptors = Object.fromEntries(['fullscreenElement', 'exitFullscreen'].map(key => [key, Object.getOwnPropertyDescriptor(document, key)]));
function mockFullscreen(element, exitFullscreen) {
  Object.defineProperties(document, {
    fullscreenElement: { configurable: true, value: element },
    exitFullscreen: { configurable: true, value: exitFullscreen },
  });
}

beforeEach(async () => {
  world.maps.length = 0; world.popups.length = 0;
  const mapbox = (await import('mapbox-gl')).default;
  mapbox.accessToken = 'pk.test';
  geoService.warehouses.mockReset().mockResolvedValue(empty);
  warehouseService.getById.mockReset().mockImplementation(id => Promise.resolve(full(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => {
  vi.useRealTimers();
  for (const [key, descriptor] of Object.entries(fullscreenDescriptors)) {
    if (descriptor) Object.defineProperty(document, key, descriptor);
    else delete document[key];
  }
});
async function mount(props = {}) {
  const view = render(<MapView {...props} />);
  const map = world.maps.at(-1);
  await act(async () => { map.emit('style.load'); map.emit('load'); });
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

  it('preserves loaded pins and open details across Satellite and Map without refetching', async () => {
    const points = { ...empty, features: [{ properties: { id: 42 } }] };
    geoService.warehouses.mockResolvedValue(points);
    const { map } = await mount({ filters: { city: 'Bengaluru' } });
    clickPin(map, 42);
    await screen.findByRole('button', { name: 'View', exact: true });
    for (const view of ['Satellite', 'Map']) {
      const button = screen.getByRole('button', { name: view, exact: true });
      fireEvent.click(button);
      expect(button).toBeDisabled();
      expect(screen.getByText('Loading map view…')).toBeInTheDocument();
      await act(async () => map.emit('style.load'));
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(map.getSource('dashboard-warehouses').data).toEqual(points);
      expect(map.layers.map(layer => layer.id)).toEqual(['dashboard-warehouse-pins']);
      expect(screen.getByText('#42')).toBeInTheDocument();
    }
    expect(map.setStyle.mock.calls.map(([style]) => style)).toEqual([
      'mapbox://styles/mapbox/satellite-streets-v12',
      'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2',
    ]);
    expect(world.maps).toHaveLength(1);
    expect(map.events['click:dashboard-warehouse-pins']).toHaveLength(1);
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
    expect(warehouseService.getById).toHaveBeenCalledTimes(1);
  });

  it('restores a warehouse response that finishes while the style is loading', async () => {
    let resolve;
    geoService.warehouses.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { map } = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    const points = { ...empty, features: [{ properties: { id: 7 } }] };
    await act(async () => resolve(points));
    await act(async () => map.emit('style.load'));
    expect(map.getSource('dashboard-warehouses').data).toEqual(points);
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 warehouse pins loaded')).toBeInTheDocument();
  });

  it('applies filters changed during a style load and discards an older response', async () => {
    let resolveOld;
    geoService.warehouses.mockImplementationOnce(() => new Promise(done => { resolveOld = done; }));
    const { map, rerender } = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    const newest = { ...empty, features: [{ properties: { id: 8 } }] };
    geoService.warehouses.mockResolvedValue(newest);
    rerender(<MapView filters={{ city: 'Chennai' }} />);
    await act(async () => map.emit('style.load'));
    await act(async () => resolveOld({ ...empty, features: [{ properties: { id: 7 } }] }));
    expect(map.getSource('dashboard-warehouses').data).toEqual(newest);
    expect(geoService.warehouses).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { city: 'Chennai' } }));
  });

  it.each(['error', 'timeout', 'throw'])('recovers a failed satellite switch after %s and allows another attempt', async failure => {
    const points = { ...empty, features: [{ properties: { id: 42 } }] };
    geoService.warehouses.mockResolvedValue(points);
    const { map } = await mount();
    vi.useFakeTimers();
    if (failure === 'throw') map.setStyle.mockImplementationOnce(() => { throw new Error('Style unavailable'); });
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    if (failure === 'error') act(() => map.emit('error'));
    if (failure === 'timeout') act(() => vi.advanceTimersByTime(15000));
    expect(map.setStyle).toHaveBeenLastCalledWith('mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2', { diff: false });
    await act(async () => map.emit('style.load'));
    expect(screen.getByText(/Satellite view could not load/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(map.getSource('dashboard-warehouses').data).toEqual(points);
    const satellite = screen.getByRole('button', { name: 'Satellite', exact: true });
    expect(satellite).toBeEnabled();
    fireEvent.click(satellite);
    await act(async () => map.emit('style.load'));
    expect(satellite).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Satellite view could not load/)).not.toBeInTheDocument();
  });

  it.each(['View', 'Edit'])('waits for fullscreen to exit before opening %s', async action => {
    const onViewDetails = vi.fn(), onEdit = vi.fn();
    const { map } = await mount({ onViewDetails, onEdit });
    let finishExit;
    const exitFullscreen = vi.fn(() => new Promise(resolve => { finishExit = resolve; }));
    mockFullscreen(screen.getByRole('region', { name: 'Warehouse map', exact: true }), exitFullscreen);
    clickPin(map, 42);
    fireEvent.click(await screen.findByRole('button', { name: action, exact: true }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(onViewDetails).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    await act(async () => finishExit());
    expect(action === 'View' ? onViewDetails : onEdit).toHaveBeenCalledWith(full(42));
    expect(action === 'View' ? onEdit : onViewDetails).not.toHaveBeenCalled();
  });

  it('keeps the warehouse popup usable when fullscreen cannot exit', async () => {
    const onViewDetails = vi.fn();
    const { map } = await mount({ onViewDetails });
    const exitFullscreen = vi.fn().mockRejectedValueOnce(new Error('Fullscreen exit failed')).mockResolvedValueOnce();
    mockFullscreen(screen.getByRole('region', { name: 'Warehouse map', exact: true }), exitFullscreen);
    clickPin(map, 42);
    fireEvent.click(await screen.findByRole('button', { name: 'View', exact: true }));
    await screen.findByText('Exit fullscreen to open this warehouse.');
    expect(onViewDetails).not.toHaveBeenCalled();
    expect(screen.getByText('#42')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View', exact: true }));
    await waitFor(() => expect(onViewDetails).toHaveBeenCalledWith(full(42)));
  });

  it('cancels style recovery and fullscreen listeners when the map is removed', async () => {
    const { map, unmount } = await mount();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    unmount();
    map.resize.mockClear();
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
      vi.advanceTimersByTime(30000);
    });
    expect(map.setStyle).toHaveBeenCalledTimes(1);
    expect(map.resize).not.toHaveBeenCalled();
    expect(map.remove).toHaveBeenCalledTimes(1);
  });

  it('stops recovery and explains when neither map style can load', async () => {
    const { map } = await mount();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByText('The map could not load. Please reload the page.')).toBeInTheDocument();
    expect(screen.queryByText('Loading map view…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Satellite', exact: true })).toBeDisabled();
    expect(map.setStyle).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(30000));
    expect(map.setStyle).toHaveBeenCalledTimes(2);
  });

  it('does not restore stale pins when access is disabled during a style change', async () => {
    geoService.warehouses.mockResolvedValue({ ...empty, features: [{ properties: { id: 42 } }] });
    const { map, rerender } = await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }));
    rerender(<MapView active={false} />);
    await act(async () => map.emit('style.load'));
    expect(map.getSource('dashboard-warehouses').data).toEqual(empty);
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Satellite', exact: true })).toBeDisabled();
    clickPin(map, 42);
    expect(warehouseService.getById).not.toHaveBeenCalled();
  });
});
