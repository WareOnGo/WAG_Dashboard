import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MicroMarketMap from '../MicroMarketMap';
import { geoService } from '../../services/geoService';
import { warehouseService } from '../../services/warehouseService';

const world = vi.hoisted(() => ({ maps: [], draws: [] }));
vi.mock('mapbox-gl', () => {
  class Map {
    constructor(options) {
      this.events = {}; this.sources = {}; this.layers = []; this.ready = false;
      this.canvas = document.createElement('canvas'); options.container.append(this.canvas);
      this.resize = vi.fn(); this.remove = vi.fn(); this.fitBounds = vi.fn(); world.maps.push(this);
    }
    on(event, layer, handler) { (this.events[handler ? `${event}:${layer}` : event] ||= []).push(handler || layer); return this; }
    off(event, handler) { this.events[event] = this.events[event]?.filter(fn => fn !== handler); }
    once(event, handler) { const once = (...args) => { this.off(event, once); handler(...args); }; return this.on(event, once); }
    emit(event, payload, layer) { if (event === 'load') this.ready = true; this.events[layer ? `${event}:${layer}` : event]?.slice().forEach(handler => handler(payload)); }
    loaded() { return this.ready; }
    addControl() {}
    getCanvas() { return this.canvas; }
    getBounds() { return { getWest: () => 77, getSouth: () => 12, getEast: () => 78, getNorth: () => 13 }; }
    addSource(id) { this.sources[id] = { setData: vi.fn() }; }
    getSource(id) { return this.sources[id]; }
    addLayer(layer) { this.layers.push(layer); }
    getLayer(id) { return this.layers.find(layer => layer.id === id); }
    getStyle() { return { layers: this.layers }; }
    setLayoutProperty(id, key, value) { const layer = this.getLayer(id); (layer.layout ||= {})[key] = value; }
  }
  class Popup {
    constructor() { this.events = {}; }
    setLngLat() { return this; }
    setDOMContent(element) { this.element = element; return this; }
    addTo() { document.body.append(this.element); return this; }
    on(event, handler) { this.events[event] = handler; return this; }
    remove() { this.events.close?.(); this.element?.remove(); }
  }
  return { default: { Map, Popup, NavigationControl: class {} } };
});
vi.mock('@mapbox/mapbox-gl-draw', () => ({ default: class {
  static modes = { simple_select: { onClick: vi.fn(), onTap: vi.fn() } };
  constructor(options) {
    this.options = options; this.mode = 'simple_select'; this.fc = { type: 'FeatureCollection', features: [] };
    this.set = vi.fn(fc => { this.fc = fc; }); this.delete = vi.fn(); world.draws.push(this);
  }
  getAll() { return structuredClone(this.fc); }
  get(id) { return this.fc.features.find(feature => feature.id === id); }
  getSelectedIds() { return []; }
  getMode() { return this.mode; }
  changeMode(mode) { this.mode = mode; }
} }));
vi.mock('../../utils/geoIcons', async original => ({ ...await original(), registerWarehouseIcons: vi.fn() }));
vi.mock('../../services/geoService', async original => ({ ...await original(), geoService: { warehouses: vi.fn() } }));
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getById: vi.fn() } }));

const empty = { type: 'FeatureCollection', features: [] };
const polygon = { type: 'Feature', id: 'area-1', properties: { name: 'Existing area' }, geometry: { type: 'Polygon', coordinates: [[[77, 12], [78, 12], [78, 13], [77, 13], [77, 12]]] } };
const areas = { ...empty, features: [polygon] };
const clickPin = (map, id = 42) => act(() => map.emit('click', { features: [{ properties: { id }, geometry: { coordinates: [77.5, 12.5] } }] }, 'mm-warehouse-pins'));

beforeEach(async () => {
  world.maps.length = 0; world.draws.length = 0;
  (await import('mapbox-gl')).default.accessToken = 'pk.test';
  geoService.warehouses.mockReset().mockResolvedValue(empty);
  warehouseService.getById.mockReset().mockResolvedValue({ id: 42, city: 'Bengaluru', warehouseType: 'PEB', ratePerSqft: '25' });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
async function mount(props = {}) {
  const view = render(<MicroMarketMap initialFC={areas} {...props} />);
  const map = world.maps.at(-1), draw = world.draws.at(-1);
  await act(async () => map.emit('load'));
  return { ...view, map, draw };
}

describe('micro-market warehouse viewport without changing polygon behavior', () => {
  it('adds one warehouse source/layer and keeps saved areas and the drawing toolbar', async () => {
    const { map, draw } = await mount();
    expect(map.layers.filter(layer => layer.type === 'symbol').map(layer => layer.id)).toEqual(['mm-warehouse-pins']);
    expect(map.getLayer('mm-area-outline')).toBeTruthy();
    expect(draw.options.controls).toEqual({ polygon: true, trash: true });
    expect(draw.set).toHaveBeenCalledExactlyOnceWith(areas);
    expect(geoService.warehouses).toHaveBeenCalledWith(expect.objectContaining({ bbox: '76.600000,11.600000,78.400000,13.400000', limit: 2000 }));
    expect(warehouseService.getById).not.toHaveBeenCalled();
  });
  it('forwards original create, edit, selection and delete events unchanged', async () => {
    const onCreate = vi.fn(), onUpdateGeometry = vi.fn(), onSelect = vi.fn(), onUserDelete = vi.fn();
    const { map, draw, rerender } = await mount({ onCreate, onUpdateGeometry, onSelect, onUserDelete });
    act(() => {
      map.emit('draw.create', { features: [polygon] }); map.emit('draw.update', { features: [polygon] });
      map.emit('draw.selectionchange', { features: [polygon] }); map.emit('draw.delete', { features: [polygon] });
    });
    expect(onCreate).toHaveBeenCalledWith(polygon);
    expect(onUpdateGeometry).toHaveBeenCalledWith(polygon);
    expect(onSelect).toHaveBeenCalledWith(['area-1']);
    expect(onUserDelete).toHaveBeenCalledWith(['area-1']);
    rerender(<MicroMarketMap initialFC={areas} showPins={false} focusReq={{ id: 'area-1' }} />);
    expect(map.fitBounds).toHaveBeenCalledWith([[77, 12], [78, 13]], { padding: 80, maxZoom: 14, duration: 600 });
    expect(draw.set).toHaveBeenCalledTimes(1);
    expect(draw.delete).not.toHaveBeenCalled();
  });
  it('hides pins, cancels pending reads and ignores late results without clearing polygons', async () => {
    let resolve;
    geoService.warehouses.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const { map, draw, rerender } = await mount();
    const { signal } = geoService.warehouses.mock.calls[0][0];
    rerender(<MicroMarketMap initialFC={areas} showPins={false} />);
    expect(signal.aborted).toBe(true);
    expect(map.getLayer('mm-warehouse-pins').layout.visibility).toBe('none');
    await act(async () => { resolve({ ...empty, features: [{ id: 'late' }] }); map.emit('moveend'); });
    expect(map.getSource('mm-warehouse-points').setData).toHaveBeenLastCalledWith(empty);
    expect(draw.set).toHaveBeenCalledTimes(1);
    rerender(<MicroMarketMap initialFC={areas} showPins />);
    await waitFor(() => expect(geoService.warehouses).toHaveBeenCalledTimes(2));
    expect(world.maps).toHaveLength(1);
  });
  it('toggles area visibility independently of cached warehouse pins', async () => {
    const { map, rerender } = await mount();
    rerender(<MicroMarketMap initialFC={areas} showAreas={false} />);
    expect(map.getLayer('mm-area-outline').layout.visibility).toBe('none');
    expect(map.getLayer('mm-warehouse-pins').layout.visibility).toBe('visible');
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
  });
  it('reloads the current camera when pins are re-enabled outside cached bounds', async () => {
    const { map, rerender } = await mount();
    rerender(<MicroMarketMap initialFC={areas} showPins={false} />);
    map.getBounds = () => ({ getWest: () => 72, getSouth: () => 18, getEast: () => 73, getNorth: () => 19 });
    act(() => map.emit('moveend'));
    expect(geoService.warehouses).toHaveBeenCalledTimes(1);
    rerender(<MicroMarketMap initialFC={areas} showPins />);
    await waitFor(() => expect(geoService.warehouses).toHaveBeenCalledTimes(2));
    expect(geoService.warehouses.mock.lastCall[0].bbox).toBe('71.600000,17.600000,73.400000,19.400000');
  });
  it('keeps pin clicks away from polygon selection while preserving vertex clicks', async () => {
    const { draw } = await mount();
    const base = (await import('@mapbox/mapbox-gl-draw')).default.modes.simple_select;
    base.onClick.mockClear();
    const context = { map: { getLayer: () => ({}), queryRenderedFeatures: () => [{ id: 42 }] } };
    draw.options.modes.simple_select.onClick.call(context, {}, { point: [5, 5] });
    expect(base.onClick).not.toHaveBeenCalled();
    const event = { point: [5, 5], featureTarget: { properties: { meta: 'vertex' } } };
    draw.options.modes.simple_select.onClick.call(context, {}, event);
    expect(base.onClick).toHaveBeenCalledWith({}, event);
  });
  it('opens touch pin details through Draw because Draw suppresses synthetic clicks', async () => {
    const { draw } = await mount();
    const pin = { properties: { id: 42 }, geometry: { coordinates: [77.5, 12.5] } };
    const context = { map: { getLayer: () => ({}), queryRenderedFeatures: () => [pin] } };
    act(() => draw.options.modes.simple_select.onTap.call(context, {}, { point: [5, 5] }));
    await screen.findByText('PEB');
    expect(warehouseService.getById).toHaveBeenCalledExactlyOnceWith(42);
  });
  it('honors an area focus requested before the initial map load', async () => {
    render(<MicroMarketMap initialFC={areas} focusReq={{ id: 'area-1' }} />);
    const map = world.maps.at(-1);
    expect(map.fitBounds).not.toHaveBeenCalled();
    await act(async () => map.emit('load'));
    expect(map.fitBounds).toHaveBeenCalledWith([[77, 12], [78, 13]], { padding: 80, maxZoom: 14, duration: 600 });
  });
  it('loads details on demand, caches repeat clicks and blocks popups during drawing/editing', async () => {
    const { map, draw } = await mount();
    draw.mode = 'draw_polygon'; clickPin(map);
    draw.mode = 'direct_select'; clickPin(map);
    expect(warehouseService.getById).not.toHaveBeenCalled();
    draw.mode = 'simple_select'; clickPin(map);
    await screen.findByText('PEB');
    clickPin(map); await screen.findByText('PEB');
    expect(warehouseService.getById).toHaveBeenCalledTimes(1);
    draw.mode = 'draw_polygon'; act(() => map.emit('draw.modechange'));
    expect(screen.queryByText('PEB')).not.toBeInTheDocument();
  });
  it('retries a failed popup and cannot let a stale popup replace the selected pin', async () => {
    warehouseService.getById.mockRejectedValueOnce(new Error('offline'));
    const { map } = await mount();
    clickPin(map);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await screen.findByText('PEB');
    let resolve;
    warehouseService.getById.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    clickPin(map, 1); clickPin(map, 2);
    await screen.findByText('#2');
    await act(async () => resolve({ id: 1, warehouseType: 'Stale record' }));
    expect(screen.queryByText('Stale record')).not.toBeInTheDocument();
  });
});
