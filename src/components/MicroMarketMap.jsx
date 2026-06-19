import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

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

// Coordinates live on the nested WarehouseData relation in the dashboard's API.
function coordsOf(w) {
  const lat = parseFloat(w.latitude ?? w.WarehouseData?.latitude ?? w.warehouseData?.latitude)
  const lng = parseFloat(w.longitude ?? w.WarehouseData?.longitude ?? w.warehouseData?.longitude)
  return { lat, lng }
}

// Strong palette for the popup badge (white text needs the contrast).
function warehouseColor(availability) {
  const a = String(availability || '').toLowerCase()
  if (a === 'yes' || a.includes('available')) return '#3d8b40'
  if (a === 'no' || a.includes('occupied')) return '#c62828'
  if (a.includes('partial')) return '#d68910'
  return '#0d5a9e'
}

function formatSpace(space) {
  if (!space) return '-'
  if (Array.isArray(space)) return space.reduce((s, v) => s + (Number(v) || 0), 0).toLocaleString()
  return String(space).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function warehousePopupHTML(w) {
  return `
    <div style="font-family:Verdana,Geneva,sans-serif;padding:10px;min-width:200px;max-width:260px;background:rgba(26,26,26,0.98);color:rgba(255,255,255,0.95);border-radius:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.15);">
        <span style="font-size:13px;font-weight:600;color:#fff;">#${w.id}</span>
        <span style="font-size:10px;padding:3px 8px;background:${warehouseColor(w.availability)};border-radius:4px;color:#fff;font-weight:500;">${w.availability || 'Unknown'}</span>
      </div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px;color:#fff;line-height:1.3;">${w.warehouseType || ''}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-bottom:8px;">${w.warehouseOwnerType || ''}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.85);margin-bottom:8px;line-height:1.4;">📍 ${w.city || ''}, ${w.state || ''}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;background:rgba(0,0,0,0.3);border-radius:4px;">
        <div>
          <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Space</div>
          <div style="font-size:12px;font-weight:600;color:#fff;">${formatSpace(w.totalSpaceSqft)} sqft</div>
        </div>
        <div>
          <div style="font-size:9px;color:rgba(255,255,255,0.55);text-transform:uppercase;margin-bottom:2px;letter-spacing:0.5px;">Rate</div>
          <div style="font-size:12px;font-weight:600;color:#fff;">₹${w.ratePerSqft || '—'}/sqft</div>
        </div>
      </div>
    </div>`
}

export default function MicroMarketMap({
  initialFC,
  warehouses = [],
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
  const whMarkersRef = useRef([])
  const showPinsRef = useRef(showPins) // so newly-created markers respect the toggle

  const cb = useRef({})
  cb.current = { onCreate, onUpdateGeometry, onUserDelete, onSelect, onRemoved }

  // Init map + draw control once.
  useEffect(() => {
    if (!mapboxgl.accessToken) return
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2', // dashboard's custom dark style
      center: [78.9629, 22.5937],
      zoom: 4,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.once('load', () => map.resize())

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      styles: DRAW_STYLES,
    })
    drawRef.current = draw
    map.addControl(draw, 'top-left')

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
      whMarkersRef.current.forEach(m => m.remove())
      whMarkersRef.current = []
      map.remove()
      mapRef.current = null
      drawRef.current = null
      loadedRef.current = false
    }
  }, [])

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
    if (map.loaded()) apply()
    else map.once('load', apply)
  }, [initialFC])

  // Render warehouses as read-only pins.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const render = () => {
      whMarkersRef.current.forEach(m => m.remove())
      whMarkersRef.current = []
      for (const w of warehouses) {
        const { lat, lng } = coordsOf(w)
        if (Number.isNaN(lng) || Number.isNaN(lat)) continue
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
        const popup = new mapboxgl.Popup({ offset: 15, closeButton: false, closeOnClick: true, anchor: 'left' })
          .setHTML(warehousePopupHTML(w))
        const marker = new mapboxgl.Marker({ color: warehouseColor(w.availability) })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map)
        marker.getElement().style.display = showPinsRef.current ? '' : 'none'
        whMarkersRef.current.push(marker)
      }
    }
    if (map.loaded()) render()
    else map.once('load', render)
    return () => { map.off('load', render) }
  }, [warehouses])

  // Toggle warehouse pin visibility without recreating the markers.
  useEffect(() => {
    showPinsRef.current = showPins
    for (const m of whMarkersRef.current) {
      m.getElement().style.display = showPins ? '' : 'none'
    }
  }, [showPins])

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
    if (map.loaded()) apply()
    else map.once('load', apply)
  }, [showAreas])

  // Fly to + select an area when requested from the sidebar.
  useEffect(() => {
    const map = mapRef.current
    const draw = drawRef.current
    if (!map || !draw || !focusReq?.id) return
    const f = draw.get(String(focusReq.id))
    if (!f) return
    const b = bbox(f.geometry)
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 14, duration: 600 })
    try { draw.changeMode('simple_select', { featureIds: [String(focusReq.id)] }) } catch { /* ignore */ }
  }, [focusReq])

  // Remove an area's geometry when deletion is initiated from the sidebar.
  useEffect(() => {
    const draw = drawRef.current
    if (!draw || !removeId) return
    try { draw.delete([String(removeId)]) } catch { /* ignore */ }
    cb.current.onRemoved?.(String(removeId))
  }, [removeId])

  return <div ref={containerRef} className="mm-map-canvas" />
}
