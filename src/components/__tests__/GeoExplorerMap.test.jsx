import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import GeoExplorerMap from '../GeoExplorerMap'
import { geoService } from '../../services/geoService'

const world = vi.hoisted(() => ({ maps: [], markers: [] }))
vi.mock('mapbox-gl', () => {
  class Map {
    constructor(options) {
      this.events = {}; this.layers = []; this.sources = {}; this.center = { lng: options.center[0], lat: options.center[1] }; this.zoom = options.zoom
      this.canvas = document.createElement('canvas'); options.container.append(this.canvas)
      this.jumpTo = vi.fn(); this.flyTo = vi.fn(); this.easeTo = vi.fn()
      world.maps.push(this)
    }
    on(event, callback) { (this.events[event] ||= []).push(callback) }
    emit(event, payload) { this.events[event]?.forEach(callback => callback(payload)) }
    addControl() {} resize() {} remove() {} setFilter() {} setLayoutProperty() {}
    getCanvas() { return this.canvas }
    getCenter() { return this.center }
    isMoving() { return false }
    getBounds() { return { getWest: () => 77, getSouth: () => 12, getEast: () => 78, getNorth: () => 14 } }
    getStyle() { return { layers: this.layers } }
    addSource(id) { this.sources[id] = { setData: vi.fn() } }
    getSource(id) { return this.sources[id] }
    addLayer(layer) { this.layers.push(layer) }
    getLayer(id) { return this.layers.find(layer => layer.id === id) }
  }
  class Marker {
    constructor() { this.element = document.createElement('div'); world.markers.push(this) }
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
})

async function mount(props = {}) {
  const mapbox = (await import('mapbox-gl')).default
  mapbox.accessToken = 'pk.test'
  const result = render(<GeoExplorerMap {...props} />)
  const map = world.maps.at(-1)
  await act(async () => map.emit('load'))
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
