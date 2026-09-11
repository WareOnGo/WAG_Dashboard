import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import { geoService, boundsToBbox } from '../services/geoService'
import { warehouseService } from '../services/warehouseService'
import { registerWarehouseIcons, warehouseIconId, availabilityExpression, AVAILABILITY_COLORS } from '../utils/geoIcons'
import { availabilityBucket } from '../utils/geoPopups'
import { createWarehouseViewportLoader, EMPTY_WAREHOUSE_POINTS } from '../utils/warehouseViewport'

const PIN_SOURCE = 'mm-warehouse-points'
const PIN_LAYER = 'mm-warehouse-pins'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

// Mild-neon draw theme for the area polygons. This mirrors mapbox-gl-draw 1.5.x's
// OWN default theme structure (single gl-draw-polygon-fill / gl-draw-lines layers
// with ["case", active, …] expressions) — just recolored. Using the matching
// structure is what makes it render correctly on Mapbox GL JS v3.
const NEON = '#22d3ee'        // active / selected cyan
const NEON_DIM = '#38bdf8'    // inactive sky
const VHALO = '#0b1220'       // vertex/point outer ring (near-black, for contrast)
const byActive = (a, b) => ['case', ['==', ['get', 'active'], 'true'], a, b]

const DRAW_STYLES = [
  {
    id: 'gl-draw-polygon-fill',
    type: 'fill',
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: { 'fill-color': byActive(NEON, NEON_DIM), 'fill-opacity': byActive(0.18, 0.08), 'fill-emissive-strength': 1 },
  },
  // NOTE: no 'gl-draw-lines' layer here on purpose. mapbox-gl-draw's own line
  // layer renders black on Mapbox GL JS v3 regardless of the color we give it, so
  // we omit it and draw the outlines ourselves (see OUTLINE_LAYER below).
  {
    id: 'gl-draw-point-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: { 'circle-radius': byActive(7, 5), 'circle-color': VHALO, 'circle-emissive-strength': 1 },
  },
  {
    id: 'gl-draw-point-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    paint: { 'circle-radius': byActive(5, 3), 'circle-color': NEON, 'circle-emissive-strength': 1 },
  },
  {
    id: 'gl-draw-vertex-outer',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: { 'circle-radius': byActive(7, 5), 'circle-color': VHALO, 'circle-emissive-strength': 1 },
  },
  {
    id: 'gl-draw-vertex-inner',
    type: 'circle',
    filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    paint: { 'circle-radius': byActive(5, 3), 'circle-color': NEON, 'circle-emissive-strength': 1 },
  },
  {
    id: 'gl-draw-midpoint',
    type: 'circle',
    filter: ['all', ['==', 'meta', 'midpoint']],
    paint: { 'circle-radius': 3, 'circle-color': NEON, 'circle-emissive-strength': 1 },
  },
]

// Our own outline layer — renders the area boundaries reliably (mapbox-gl-draw's
// line layer renders black on GL JS v3). Fed from draw.getAll() on every render.
const OUTLINE_SRC = 'mm-area-outline-src'
const OUTLINE_LAYER = 'mm-area-outline'

function ensureOutlineLayer(map) {
  if (!map.getSource(OUTLINE_SRC)) {
    map.addSource(OUTLINE_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  }
  if (!map.getLayer(OUTLINE_LAYER)) {
    map.addLayer({
      id: OUTLINE_LAYER,
      type: 'line',
      source: OUTLINE_SRC,
      filter: ['any', ['==', '$type', 'Polygon'], ['==', '$type', 'LineString']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', '_active'], 'true'], NEON, NEON_DIM],
        'line-width': ['case', ['==', ['get', '_active'], 'true'], 3, 2],
        // v3 Standard styles light custom layers; full emissive = show true color.
        'line-emissive-strength': 1,
      },
    })
  }
}

// Mirror Draw's current features into our outline source, tagging the selected
// one(s) as _active so they render brighter/thicker.
function syncOutline(map, draw) {
  const src = map.getSource(OUTLINE_SRC)
  if (!src) return
  const fc = draw.getAll()
  let selected = []
  try { selected = draw.getSelectedIds() || [] } catch { /* ignore */ }
  const sel = new Set(selected.map(String))
  for (const f of fc.features) {
    f.properties = { ...(f.properties || {}), _active: sel.has(String(f.id)) ? 'true' : 'false' }
  }
  src.setData(fc)
}

// Bounding box [[minLng,minLat],[maxLng,maxLat]] for a Polygon/MultiPolygon.
function bbox(geom) {
  if (!geom) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const rings =
    geom.type === 'Polygon' ? geom.coordinates :
    geom.type === 'MultiPolygon' ? geom.coordinates.flat() : []
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null
}

function formatSpace(space) {
  if (!space) return '-'
  if (Array.isArray(space)) return space.reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString()
  return String(space).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// DOM markers previously kept their clicks away from Draw. Preserve that
// behavior for the WebGL pins while letting vertex/midpoint actions win.
function warehouseAwareSelectMode(onPinTap) {
  const base = MapboxDraw.modes.simple_select
  const guard = (handler, inspect = false) => function (state, event) {
    const meta = event.featureTarget?.properties?.meta
    const handle = meta === 'vertex' || meta === 'midpoint'
    const pins = !handle && this.map.getLayer(PIN_LAYER)
      ? this.map.queryRenderedFeatures(event.point, { layers: [PIN_LAYER] }) : []
    if (pins.length) {
      base.stopExtendedInteractions?.call(this, state)
      // Draw prevents synthetic mouse clicks after touchend, so inspect taps
      // here using its existing tap detection rather than a second gesture path.
      if (inspect) onPinTap({ ...event, features: pins })
      return
    }
    return handler.call(this, state, event)
  }
  return { ...base, onClick: guard(base.onClick), onTap: guard(base.onTap, true) }
}

function WarehousePinCard({ id, warehouse, loading, error, onRetry }) {
  return <div className="mm-pin-card">
    <div className="mm-pin-card__header">
      <strong>#{id}</strong>
      {warehouse && <span className="mm-pin-card__availability" style={{ background: AVAILABILITY_COLORS[availabilityBucket(warehouse.availability)] }}>{warehouse.availability || 'Unknown'}</span>}
    </div>
    {loading && <div role="status">Loading warehouse…</div>}
    {error && <div role="alert">Could not load this warehouse. <button onClick={onRetry}>Retry</button></div>}
    {warehouse && <>
      <strong className="mm-pin-card__type">{warehouse.warehouseType}</strong>
      <div className="mm-pin-card__owner">{warehouse.warehouseOwnerType}</div>
      <div>{[warehouse.city, warehouse.state].filter(Boolean).join(', ')}</div>
      <div className="mm-pin-card__metrics">
        <div><span>Space</span><strong>{formatSpace(warehouse.totalSpaceSqft)} sq ft</strong></div>
        <div><span>Rate</span><strong>₹{warehouse.ratePerSqft || '—'}/sq ft</strong></div>
      </div>
    </>}
  </div>
}

export default function MicroMarketMap({
  initialFC,
  onWarehouseStatus,
  pinRefreshKey = 0,
  showAreas = true,
  showPins = true,
  onCreate,
  onUpdateGeometry,
  onUserDelete,
  onSelect,
  focusReq,
  removeId,
  onRemoved,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const drawRef = useRef(null)
  const loadedRef = useRef(false)
  const loaderRef = useRef(null)
  const pinsReadyRef = useRef(false)
  const refreshTimerRef = useRef(null)
  const popupRef = useRef(null)
  const detailCache = useRef(new Map())
  const [popupContent, setPopupContent] = useState(null)
  const showPinsRef = useRef(showPins)
  showPinsRef.current = showPins

  const cb = useRef({})
  cb.current = { onCreate, onUpdateGeometry, onUserDelete, onSelect, onRemoved, onWarehouseStatus }

  const refreshPins = useCallback((force = false) => {
    if (!mapRef.current || !pinsReadyRef.current || !showPinsRef.current) return
    void loaderRef.current?.load(boundsToBbox(mapRef.current.getBounds()), {}, force)
  }, [])

  const loadPopup = useCallback(async entry => {
    if (!entry || popupRef.current !== entry) return
    setPopupContent({ ...entry, loading: true, error: false })
    const cache = detailCache.current
    if (!cache.has(entry.id)) {
      if (cache.size >= 100) cache.delete(cache.keys().next().value)
      const request = warehouseService.getById(entry.id).catch(error => {
        if (cache.get(entry.id) === request) cache.delete(entry.id)
        throw error
      })
      cache.set(entry.id, request)
    }
    try {
      const warehouse = await cache.get(entry.id)
      if (popupRef.current === entry) setPopupContent({ ...entry, warehouse, loading: false, error: false })
    } catch {
      if (popupRef.current === entry) setPopupContent({ ...entry, loading: false, error: true })
    }
  }, [])

  // Init map + draw control once.
  useEffect(() => {
    if (!mapboxgl.accessToken) {
      cb.current.onWarehouseStatus?.({ loading: false, error: 'The map is not configured.' })
      return
    }
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2', // dashboard's custom dark style
      center: [78.9629, 22.5937],
      zoom: 4,
      renderWorldCopies: false,
    })
    mapRef.current = map
    const detailRequests = detailCache.current
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.getCanvas().setAttribute('aria-label', 'Micro-market map. Use arrow keys to pan and plus or minus to zoom.')
    const loader = createWarehouseViewportLoader({
      fetchPoints: geoService.warehouses,
      onData: fc => map.getSource(PIN_SOURCE)?.setData(fc),
      onStatus: patch => cb.current.onWarehouseStatus?.(patch),
    })
    loaderRef.current = loader
    const scheduleRefresh = () => {
      clearTimeout(refreshTimerRef.current)
      if (showPinsRef.current) refreshTimerRef.current = setTimeout(() => refreshPins(), 180)
    }
    const resize = () => { map.resize(); scheduleRefresh() }
    const observer = new ResizeObserver(resize)
    observer.observe(containerRef.current)
    window.addEventListener('resize', resize)
    window.addEventListener('orientationchange', resize)
    map.on('moveend', scheduleRefresh)
    map.once('load', () => {
      map.resize()
      map.addSource(PIN_SOURCE, { type: 'geojson', data: EMPTY_WAREHOUSE_POINTS })
      registerWarehouseIcons(map)
      const vertexLayer = map.getStyle()?.layers.find(layer => layer.id.startsWith('gl-draw') && layer.type === 'circle')?.id
      map.addLayer({
        id: PIN_LAYER, type: 'symbol', source: PIN_SOURCE,
        layout: {
          visibility: showPinsRef.current ? 'visible' : 'none',
          'icon-allow-overlap': true, 'icon-ignore-placement': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.85, 12, 1.1, 16, 1.3],
          'icon-image': ['match', availabilityExpression,
            'available', warehouseIconId('available'),
            'unavailable', warehouseIconId('unavailable'), warehouseIconId('unknown')],
        },
        paint: { 'icon-emissive-strength': 1 },
      }, vertexLayer)
      pinsReadyRef.current = true
      cb.current.onWarehouseStatus?.({ ready: true, loading: false, error: null })
      refreshPins()
    })
    map.on('error', () => {
      if (!pinsReadyRef.current) cb.current.onWarehouseStatus?.({ loading: false, error: 'The map could not load. Please reload the page.' })
    })

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: DRAW_STYLES,
      modes: { ...MapboxDraw.modes, simple_select: warehouseAwareSelectMode(event => openPin(event)) },
    })
    drawRef.current = draw
    map.addControl(draw, 'top-left')

    // Pin inspection is read-only and never intercepts drawing or vertex editing.
    map.on('mouseenter', PIN_LAYER, () => {
      if (draw.getMode() === 'simple_select') map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', PIN_LAYER, () => { map.getCanvas().style.cursor = '' })
    const openPin = event => {
      if (!showPinsRef.current || draw.getMode() !== 'simple_select') return
      const feature = event.features?.[0]
      const id = Number(feature?.properties?.id)
      if (!Number.isSafeInteger(id) || id <= 0) return
      popupRef.current?.popup.remove()
      const element = document.createElement('div')
      element.className = 'mm-pin-popup__scroll'
      const popup = new mapboxgl.Popup({
        anchor: 'bottom', offset: [0, -15], maxWidth: '260px', className: 'mm-pin-popup',
        closeButton: true, closeOnClick: true, closeOnMove: false, focusAfterOpen: false,
      }).setLngLat(feature.geometry.coordinates).setDOMContent(element).addTo(map)
      const entry = { id, element, popup }
      popupRef.current = entry
      const positionPopup = () => {
        const { clientWidth: width, clientHeight: height } = containerRef.current
        if (!width || !height) return
        element.style.maxHeight = `${Math.max(80, height - 40)}px`
        const node = popup.getElement()
        const { x, y } = map.project(feature.geometry.coordinates)
        const left = x - node.offsetWidth / 2, top = y - node.offsetHeight - 15
        const dx = Math.max(8, Math.min(left, width - node.offsetWidth - 8)) - left
        const dy = Math.max(8, Math.min(top, height - node.offsetHeight - 8)) - top
        popup.setOffset([dx, dy - 15])
        node.classList.toggle('mm-pin-popup--shifted', Math.abs(dx) > 1 || Math.abs(dy) > 1)
      }
      const popupObserver = new ResizeObserver(positionPopup)
      popupObserver.observe(element)
      map.on('move', positionPopup)
      popup.on('close', () => {
        popupObserver.disconnect()
        map.off('move', positionPopup)
        if (popupRef.current !== entry) return
        popupRef.current = null
        setPopupContent(null)
      })
      void loadPopup(entry)
    }
    map.on('click', PIN_LAYER, openPin)
    const onModeChange = () => {
      if (draw.getMode() !== 'simple_select') popupRef.current?.popup.remove()
    }
    map.on('draw.modechange', onModeChange)


    // Our own outline layer + keep it in sync with Draw's features on every render.
    const ensureAndSync = () => { ensureOutlineLayer(map); syncOutline(map, draw) }
    if (map.loaded()) ensureAndSync()
    else map.once('load', ensureAndSync)
    const onRenderEv = () => syncOutline(map, draw)
    map.on('draw.render', onRenderEv)

    const onCreateEv = (e) => e.features.forEach(f => cb.current.onCreate?.(f))
    const onUpdateEv = (e) => e.features.forEach(f => cb.current.onUpdateGeometry?.(f))
    const onDeleteEv = (e) => cb.current.onUserDelete?.(e.features.map(f => f.id))
    const onSelEv = (e) => cb.current.onSelect?.(e.features.map(f => f.id))

    map.on('draw.create', onCreateEv)
    map.on('draw.update', onUpdateEv)
    map.on('draw.delete', onDeleteEv)
    map.on('draw.selectionchange', onSelEv)

    return () => {
      map.off('draw.render', onRenderEv)
      map.off('draw.create', onCreateEv)
      map.off('draw.update', onUpdateEv)
      map.off('draw.delete', onDeleteEv)
      map.off('draw.selectionchange', onSelEv)
      clearTimeout(refreshTimerRef.current)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      map.off('moveend', scheduleRefresh)
      map.off('draw.modechange', onModeChange)
      loader.dispose()
      const popup = popupRef.current
      popupRef.current = null
      popup?.popup.remove()
      detailRequests.clear()
      pinsReadyRef.current = false
      loaderRef.current = null
      map.remove()
      mapRef.current = null
      drawRef.current = null
      loadedRef.current = false
    }
  }, [refreshPins, loadPopup])

  // Load saved areas into the draw layer once map + data are ready.
  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !initialFC || loadedRef.current) return
    const apply = () => {
      if (loadedRef.current) return
      draw.set(initialFC)
      loadedRef.current = true
    }
    if (pinsReadyRef.current) apply()
    else map.once('load', apply)
    return () => map.off('load', apply)
  }, [initialFC])

  // Hiding pins also suspends viewport reads. Re-enable against the current
  // camera; reuse complete cached bounds when they still cover it.
  useEffect(() => {
    const map = mapRef.current
    if (map?.getLayer(PIN_LAYER)) map.setLayoutProperty(PIN_LAYER, 'visibility', showPins ? 'visible' : 'none')
    if (showPins) refreshPins()
    else {
      clearTimeout(refreshTimerRef.current)
      loaderRef.current?.dispose()
      popupRef.current?.popup.remove()
      cb.current.onWarehouseStatus?.({ loading: false })
    }
  }, [showPins, refreshPins])

  useEffect(() => {
    if (pinRefreshKey) refreshPins(true)
  }, [pinRefreshKey, refreshPins])

  // Show/hide drawn area overlays (review toggle) without deleting any data.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const vis = showAreas ? 'visible' : 'none'
      const layers = map.getStyle()?.layers || []
      for (const l of layers) {
        if (l.id.startsWith('gl-draw') || l.id === OUTLINE_LAYER) {
          map.setLayoutProperty(l.id, 'visibility', vis)
        }
      }
    }
    if (pinsReadyRef.current) apply()
    else map.once('load', apply)
    return () => map.off('load', apply)
  }, [showAreas])

  // Fly to + select an area when requested from the sidebar.
  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !focusReq?.id) return
    const apply = () => {
      const f = draw.get(String(focusReq.id))
      if (!f) return
      const b = bbox(f.geometry)
      if (b) map.fitBounds(b, { padding: 80, maxZoom: 14, duration: 600 })
      try { draw.changeMode('simple_select', { featureIds: [String(focusReq.id)] }) } catch { /* ignore */ }
    }
    if (loadedRef.current) apply()
    else map.once('load', apply)
    return () => map.off('load', apply)
  }, [focusReq, initialFC])

  // Remove an area's geometry when deletion is initiated from the sidebar.
  useEffect(() => {
    const draw = drawRef.current
    if (!draw || !removeId) return
    try { draw.delete([String(removeId)]) } catch { /* ignore */ }
    cb.current.onRemoved?.(String(removeId))
  }, [removeId])

  return <>
    <div ref={containerRef} className="mm-map-canvas" />
    {popupContent && createPortal(<WarehousePinCard {...popupContent} onRetry={() => loadPopup(popupRef.current)} />, popupContent.element)}
  </>
}
