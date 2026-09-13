import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GeoExplorerMap from '../GeoExplorerMap'
import { geoService } from '../../services/geoService'

const world = vi.hoisted(() => ({ maps: [], markers: [], locate: null }))
vi.mock('mapbox-gl', () => {
  class Map {
    constructor(options) {
      this.events = {}; this.layers = []; this.sources = {}; this.center = { lng: options.center[0], lat: options.center[1] }; this.zoom = options.zoom
      this.canvas = document.createElement('canvas'); options.container.append(this.canvas)
      this.jumpTo = vi.fn(); this.flyTo = vi.fn(); this.easeTo = vi.fn()
      this.setStyle = vi.fn(() => { this.layers = []; this.sources = {} })
      world.maps.push(this)
    }
    on(event, callback) { (this.events[event] ||= []).push(callback) }
    emit(event, payload) { this.events[event]?.forEach(callback => callback(payload)) }
    addControl() {} resize() {} remove() {}
    setFilter(id, filter) { this.getLayer(id).filter = filter }
    setLayoutProperty(id, name, value) { this.getLayer(id).layout[name] = value }
    getCanvas() { return this.canvas }
    getCenter() { return this.center }
    getZoom() { return this.zoom }
    isMoving() { return false }
    getBounds() { return { getWest: () => 77, getSouth: () => 12, getEast: () => 78, getNorth: () => 14 } }
    getStyle() { return { layers: this.layers } }
    addSource(id, { data }) { this.sources[id] = { data, setData: vi.fn(next => { this.sources[id].data = next }) } }
    getSource(id) { return this.sources[id] }
    addLayer(layer, before) {
      if (before) this.layers.splice(this.layers.findIndex(l => l.id === before), 0, layer)
      else this.layers.push(layer)
    }
    getLayer(id) { return this.layers.find(layer => layer.id === id) }
  }
  class Marker {
    constructor(options = {}) { this.element = options.element || document.createElement('div'); world.markers.push(this) }
    setLngLat(at) { this.at = at; return this }
    getLngLat() { return this.at }
    addTo() { return this }
    getElement() { return this.element }
    on() {} remove() {}
  }
  return { default: { Map, Marker, NavigationControl: class {} } }
})
vi.mock('../../utils/geoIcons', () => ({ registerMapIcons: vi.fn(), ensureCategoryIcon: () => 'icon', warehouseIconId: () => 'warehouse', ownIconExpression: 'own', availabilityExpression: 'available' }))
vi.mock('../../utils/geoPopups', () => ({ warehousePopupHTML: vi.fn(), osmPopupHTML: vi.fn(), ownPopupHTML: vi.fn() }))
vi.mock('../../services/geoService', async importOriginal => ({
  ...await importOriginal(),
  geoService: { points: vi.fn(), warehouses: vi.fn(), osmPois: vi.fn() },
}))

const empty = { type: 'FeatureCollection', features: [] }
beforeEach(() => {
  vi.stubEnv('VITE_MAPBOX_TOKEN', 'pk.test')
  // Mapbox's token is assigned at import time; set it for this isolated map fake.
  world.maps.length = 0; world.markers.length = 0
  for (const method of Object.values(geoService)) method.mockReset().mockResolvedValue(empty)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('isSecureContext', true)
  world.locate = vi.fn()
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: world.locate } })
})

async function mount(props = {}) {
  const mapbox = (await import('mapbox-gl')).default
  mapbox.accessToken = 'pk.test'
  const result = render(<GeoExplorerMap {...props} />)
  const map = world.maps.at(-1)
  await act(async () => { map.emit('style.load'); map.emit('load') })
  return { ...result, map }
}

describe('GIS camera and data regressions', () => {
  it('never moves the camera when adding, selecting or confirming a pin', async () => {
    const onEditPoint = vi.fn()
    const props = { onEditPoint, enabledOsmCategories: [] }
    const { rerender, map } = await mount(props)
    rerender(<GeoExplorerMap {...props} placingPoint />)
    const at = { lat: 13.02, lng: 77.64 }
    act(() => map.emit('click', { lngLat: at }))
    expect(world.markers.at(-1).getLngLat()).toEqual(at)
    fireEvent.click(screen.getByRole('button', { name: 'Use this location' }))
    expect(onEditPoint).toHaveBeenCalledWith(at)
    expect(map.center).toEqual({ lat: 12.95, lng: 77.6 })
    expect(map.zoom).toBe(10)
    for (const method of ['jumpTo', 'flyTo', 'easeTo']) expect(map[method]).not.toHaveBeenCalled()
  })

  it('restores the chosen pin on Reposition without moving the map', async () => {
    const at = { lat: 13.02, lng: 77.64 }
    const { map } = await mount({ placingPoint: true, placementLocation: at })
    expect(world.markers.at(-1).getLngLat()).toEqual(at)
    expect(map.jumpTo).not.toHaveBeenCalled()
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('fetches a newly enabled category even inside the cached viewport', async () => {
    const { rerender } = await mount({ enabledOsmCategories: ['fuel'] })
    await waitFor(() => expect(geoService.osmPois).toHaveBeenCalledWith(expect.objectContaining({ categories: ['fuel'] })))
    rerender(<GeoExplorerMap enabledOsmCategories={['fuel', 'hospital']} />)
    await waitFor(() => expect(geoService.osmPois).toHaveBeenLastCalledWith(expect.objectContaining({ categories: ['fuel', 'hospital'] })))
  })

  it('ignores an older layer response arriving after a newer selection', async () => {
    let resolveOld
    geoService.osmPois.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { rerender, map } = await mount({ enabledOsmCategories: ['fuel'] })
    const newest = { ...empty, features: [{ id: 'hospital' }] }
    geoService.osmPois.mockResolvedValue(newest)
    rerender(<GeoExplorerMap enabledOsmCategories={['hospital']} />)
    await waitFor(() => expect(map.getSource('osm-poi-src').setData).toHaveBeenLastCalledWith(newest))
    await act(async () => resolveOld({ ...empty, features: [{ id: 'old-fuel' }] }))
    expect(map.getSource('osm-poi-src').setData).toHaveBeenLastCalledWith(newest)
  })
})

describe('GIS basemap switching', () => {
  it('restores cached pins, selected layers and the draft across both views without extra data requests', async () => {
    const points = { ...empty, features: [{ id: 'saved' }] }
    geoService.points.mockResolvedValue(points)
    const at = { lat: 13.02, lng: 77.64 }
    const { map } = await mount({ enabledOsmCategories: ['fuel'], showWarehouses: false, placingPoint: true, placementLocation: at })
    const pin = world.markers[0]
    for (const view of ['Satellite', 'Map']) {
      fireEvent.click(screen.getByRole('button', { name: view, exact: true }))
      expect(screen.getByRole('button', { name: view, exact: true })).toBeDisabled()
      expect(map.getSource('own-poi-src')).toBeUndefined()
      await act(async () => map.emit('style.load'))
      expect(map.getSource('own-poi-src').data).toEqual(points)
      expect(map.getLayer('warehouse-dots').layout.visibility).toBe('none')
      expect(map.getLayer('osm-poi-fuel').layout.visibility).toBe('visible')
      expect(screen.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true')
      expect(pin.getLngLat()).toEqual(at)
    }
    expect(geoService.points).toHaveBeenCalledTimes(1)
    expect(geoService.osmPois).toHaveBeenCalledTimes(1)
    expect(map.events.click).toHaveLength(1)
    expect(map.flyTo).not.toHaveBeenCalled()
    expect(map.setStyle.mock.calls.map(([url]) => url)).toEqual([
      'mapbox://styles/mapbox/satellite-streets-v12',
      'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2',
    ])
    expect(screen.queryByRole('button', { name: 'Place at map center' })).not.toBeInTheDocument()
  })

  it('applies changes made during a style load and ignores responses from the previous style', async () => {
    let resolveOld
    geoService.osmPois.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    const { map, rerender } = await mount({ enabledOsmCategories: ['fuel'] })
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }))
    const newest = { ...empty, features: [{ id: 'hospital' }] }
    geoService.osmPois.mockResolvedValue(newest)
    rerender(<GeoExplorerMap enabledOsmCategories={['hospital']} showOwnPoints={false} />)
    await act(async () => map.emit('style.load'))
    await act(async () => resolveOld({ ...empty, features: [{ id: 'old-fuel' }] }))
    expect(map.getSource('osm-poi-src').data).toEqual(newest)
    expect(map.getLayer('osm-poi-fuel')).toBeUndefined()
    expect(map.getLayer('osm-poi-hospital').layout.visibility).toBe('visible')
    expect(map.getLayer('own-poi-dots').layout.visibility).toBe('none')
  })

  it('returns to the previous view when the requested style fails, retaining the draft', async () => {
    const onNoticeChange = vi.fn()
    const { map } = await mount({ onNoticeChange, placingPoint: true })
    const pin = world.markers[0]
    fireEvent.click(screen.getByRole('button', { name: 'Satellite', exact: true }))
    act(() => map.emit('error', { error: new Error('Style unavailable') }))
    expect(map.setStyle).toHaveBeenLastCalledWith('mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2', { diff: false })
    await act(async () => map.emit('style.load'))
    expect(screen.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Satellite', exact: true })).toBeEnabled()
    expect(world.markers[0]).toBe(pin)
    expect(onNoticeChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', message: expect.stringContaining('could not load') }))
  })
})

describe('GIS current location', () => {
  const position = { coords: { latitude: 13.02, longitude: 77.64, accuracy: 25 } }

  it('requests location only on click and keeps browsing separate from creating a point', async () => {
    const onEditPoint = vi.fn()
    const { map } = await mount({ onEditPoint })
    expect(world.locate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    expect(screen.getByRole('button', { name: 'Cancel finding location' })).toBeEnabled()
    act(() => world.locate.mock.calls[0][0](position))
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [77.64, 13.02], zoom: 16 }))
    expect(map.flyTo).not.toHaveBeenCalled()
    expect(onEditPoint).not.toHaveBeenCalled()
    expect(world.markers.at(-1).getElement()).toHaveAttribute('aria-label', expect.stringContaining('25 m'))
  })

  it('positions the draft at the device fix but requires confirmation before editing or saving', async () => {
    const onEditPoint = vi.fn()
    await mount({ placingPoint: true, onEditPoint })
    const pin = world.markers[0]
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    expect(screen.getByRole('button', { name: 'Use this location' })).toBeDisabled()
    act(() => world.locate.mock.calls[0][0](position))
    expect(pin.getLngLat()).toEqual({ lat: 13.02, lng: 77.64 })
    expect(onEditPoint).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use this location' }))
    expect(onEditPoint).toHaveBeenCalledWith({ lat: 13.02, lng: 77.64 })
  })

  it.each(['cancel', 'tap', 'leave'])('ignores a late location result after %s', async (action) => {
    const { map, rerender } = await mount({ placingPoint: true })
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    if (action === 'cancel') fireEvent.click(screen.getByRole('button', { name: 'Cancel finding location' }))
    if (action === 'tap') act(() => map.emit('click', { lngLat: { lat: 12, lng: 78 } }))
    if (action === 'leave') rerender(<GeoExplorerMap placingPoint={false} />)
    act(() => world.locate.mock.calls[0][0](position))
    expect(map.flyTo).not.toHaveBeenCalled()
    expect(map.easeTo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use current location' })).toBeEnabled()
  })

  it.each([[1, 'permission'], [2, 'location service is unavailable'], [3, 'did not return a location']])('handles geolocation error %s and allows retry', async (code, message) => {
    const onNoticeChange = vi.fn()
    const { map } = await mount({ onNoticeChange })
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    act(() => world.locate.mock.calls[0][1]({ code }))
    expect(onNoticeChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'warning', message: expect.stringContaining(message) }))
    expect(map.flyTo).not.toHaveBeenCalled()
    expect(map.easeTo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    expect(world.locate).toHaveBeenCalledTimes(2)
  })

  it('requests a precise fix after a timeout only when the user asks', async () => {
    const onNoticeChange = vi.fn()
    const onEditPoint = vi.fn()
    const { map } = await mount({ placingPoint: true, onNoticeChange, onEditPoint })
    const pin = world.markers[0]
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    act(() => world.locate.mock.calls[0][1]({ code: 3 }))
    expect(world.locate).toHaveBeenCalledOnce()
    const action = onNoticeChange.mock.calls.at(-1)[0].actions[0]
    expect(action.label).toBe('Try precise location')
    act(() => action.onClick())
    expect(world.locate.mock.calls[1][2]).toMatchObject({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
    act(() => world.locate.mock.calls[1][0](position))
    expect(pin.getLngLat()).toEqual({ lat: 13.02, lng: 77.64 })
    expect(map.easeTo).toHaveBeenCalledOnce()
    expect(onEditPoint).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Use this location' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Use current location' })).toBeEnabled()
  })

  it('asks before showing a broad estimate, then zooms onto the accepted point', async () => {
    const onNoticeChange = vi.fn()
    const { map } = await mount({ onNoticeChange })
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    act(() => world.locate.mock.calls[0][0]({ coords: { ...position.coords, accuracy: 5000 } }))
    const notice = onNoticeChange.mock.calls.at(-1)[0]
    expect(notice.message).toContain('Only a broad estimate is available (±5.0 km)')
    expect(map.easeTo).not.toHaveBeenCalled()
    expect(notice.actions[0].label).toBe('Show area')
    act(() => notice.actions[0].onClick())
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [77.64, 13.02], zoom: 16 }))
  })

  it('preserves a closer zoom when using current location', async () => {
    const { map } = await mount()
    map.zoom = 18
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    act(() => world.locate.mock.calls[0][0](position))
    expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [77.64, 13.02], zoom: 18 }))
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it('never overwrites a manually placed pin with a stale broad estimate', async () => {
    const onNoticeChange = vi.fn()
    const { map } = await mount({ placingPoint: true, onNoticeChange })
    const pin = world.markers[0]
    const before = pin.getLngLat()
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    act(() => world.locate.mock.calls[0][0]({ coords: { ...position.coords, accuracy: 50000 } }))
    const action = onNoticeChange.mock.calls.at(-1)[0].actions[0]
    expect(action.label).toBe('Use estimate')
    expect(pin.getLngLat()).toEqual(before)
    const at = { lat: 12.91, lng: 79.13 }
    act(() => map.emit('click', { lngLat: at }))
    act(() => action.onClick())
    expect(pin.getLngLat()).toEqual(at)
    expect(map.flyTo).not.toHaveBeenCalled()
    expect(map.easeTo).not.toHaveBeenCalled()
  })

  it.each(['insecure', 'unsupported'])('explains an %s browser without requesting location', async (reason) => {
    const onNoticeChange = vi.fn()
    await mount({ onNoticeChange })
    if (reason === 'insecure') vi.stubGlobal('isSecureContext', false)
    else Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Use current location' }))
    expect(world.locate).not.toHaveBeenCalled()
    expect(onNoticeChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
  })
})
