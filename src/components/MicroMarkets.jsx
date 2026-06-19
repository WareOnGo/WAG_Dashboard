import { useEffect, useRef, useState } from 'react'
import { App, Result } from 'antd'
import { useAuth } from '../contexts'
import { microMarketService } from '../services/microMarketService'
import { warehouseService } from '../services/warehouseService'
import MicroMarketMap from './MicroMarketMap'
import MicroMarketSidebar from './MicroMarketSidebar'
import './MicroMarkets.css'

const hasToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN)

// [lng, lat] for a warehouse (coords live on the nested WarehouseData relation).
const whLngLat = (w) => [
  parseFloat(w.longitude ?? w.WarehouseData?.longitude ?? w.warehouseData?.longitude),
  parseFloat(w.latitude ?? w.WarehouseData?.latitude ?? w.warehouseData?.latitude),
]

// Ray-casting point-in-ring test.
function pointInRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    const hit = ((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
    if (hit) inside = !inside
  }
  return inside
}

// Best-guess city for a freshly drawn polygon: the most common city among the
// warehouses that fall inside it. '' if no warehouses land inside.
function inferCity(geometry, warehouses) {
  const ring = geometry?.type === 'Polygon' ? geometry.coordinates?.[0] : null
  if (!ring) return ''
  const counts = new Map()
  for (const w of warehouses) {
    const [lng, lat] = whLngLat(w)
    if (Number.isNaN(lng) || Number.isNaN(lat)) continue
    if (pointInRing(lng, lat, ring)) {
      const c = (w.city || '').trim()
      if (c) counts.set(c, (counts.get(c) || 0) + 1)
    }
  }
  let best = '', n = 0
  for (const [c, k] of counts) if (k > n) { best = c; n = k }
  return best
}

export default function MicroMarkets() {
  const { user } = useAuth()
  const { message } = App.useApp()
  const canAccess = !!user?.isReviewer || !!user?.isAdmin

  const [areas, setAreas] = useState([])          // [{ id, name, city, reviewerName, reviewerEmail }]
  const [initialFC, setInitialFC] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [focusReq, setFocusReq] = useState(null)
  const [removeId, setRemoveId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showAreas, setShowAreas] = useState(true)
  const [showPins, setShowPins] = useState(true)
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)

  const areasRef = useRef(areas)
  areasRef.current = areas
  const geomTimers = useRef(new Map())
  const savedMetaRef = useRef(new Map())

  // Clear pending debounced geometry saves on unmount.
  useEffect(() => () => {
    geomTimers.current.forEach(t => clearTimeout(t))
    geomTimers.current.clear()
  }, [])

  useEffect(() => {
    if (!canAccess) return
    microMarketService.list()
      .then(fc => {
        setInitialFC(fc)
        const list = (fc?.features || []).map(f => ({
          id: String(f.id),
          name: f.properties?.name || '',
          city: f.properties?.city || '',
          groupCity: f.properties?.city || '', // committed city used for grouping
          reviewerName: f.properties?.reviewerName || '',
          reviewerEmail: f.properties?.reviewerEmail || '',
        }))
        list.forEach(a => savedMetaRef.current.set(a.id, { name: a.name, city: a.city }))
        setAreas(list)
      })
      .catch(e => message.error('Could not load areas: ' + (e.message || e)))
      .finally(() => setLoadingAreas(false))
  }, [canAccess, message])

  useEffect(() => {
    if (!canAccess) return
    warehouseService.getAll()
      .then(rows => setWarehouses(Array.isArray(rows) ? rows : (rows?.data || [])))
      .catch(e => message.error('Could not load warehouses: ' + (e.message || e)))
      .finally(() => setLoadingWarehouses(false))
  }, [canAccess, message])

  const handleCreate = async (feature) => {
    try {
      // Auto-fill city from the warehouses that fall inside the drawn polygon.
      const city = inferCity(feature.geometry, warehouses)
      const saved = await microMarketService.create({
        id: String(feature.id), name: '', city, geometry: feature.geometry,
      })
      const id = String(saved.id)
      setAreas(a => [...a, {
        id, name: '', city, groupCity: city,
        reviewerName: saved.properties?.reviewerName || '',
        reviewerEmail: saved.properties?.reviewerEmail || '',
      }])
      savedMetaRef.current.set(id, { name: '', city })
      setSelectedId(id)
    } catch (e) { message.error(e.message || 'Create failed') }
  }

  // Debounced (600ms) per feature so a drag fires one save, not dozens.
  const handleUpdateGeometry = (feature) => {
    const id = String(feature.id)
    const geometry = feature.geometry
    const timers = geomTimers.current
    if (timers.has(id)) clearTimeout(timers.get(id))
    timers.set(id, setTimeout(async () => {
      timers.delete(id)
      try { await microMarketService.update(id, { geometry }) }
      catch (e) { message.error(e.message || 'Save failed') }
    }, 600))
  }

  const handleUserDelete = async (ids) => {
    const sids = ids.map(String)
    setAreas(a => a.filter(x => !sids.includes(x.id)))
    sids.forEach(id => savedMetaRef.current.delete(id))
    if (selectedId && sids.includes(selectedId)) setSelectedId(null)
    try { await Promise.all(sids.map(id => microMarketService.delete(id))) }
    catch (e) { message.error(e.message || 'Delete failed') }
  }

  const handleSelect = (ids) => setSelectedId(ids[0] ? String(ids[0]) : null)

  const changeMeta = (id, patch) =>
    setAreas(a => a.map(x => (x.id === id ? { ...x, ...patch } : x)))

  const commitMeta = async (id) => {
    const area = areasRef.current.find(x => x.id === id)
    if (!area) return
    const saved = savedMetaRef.current.get(id)
    if (saved && saved.name === area.name && saved.city === area.city) return
    try {
      await microMarketService.update(id, { name: area.name, city: area.city })
      savedMetaRef.current.set(id, { name: area.name, city: area.city })
      // Re-group only after commit (input has blurred), so editing city mid-type
      // doesn't move the card and steal focus.
      setAreas(a => a.map(x => (x.id === id ? { ...x, groupCity: area.city } : x)))
    } catch (e) { message.error(e.message || 'Save failed') }
  }

  const requestDelete = (id) => setRemoveId(String(id))

  const onRemovedFromMap = async (id) => {
    setRemoveId(null)
    setAreas(a => a.filter(x => x.id !== id))
    savedMetaRef.current.delete(id)
    if (selectedId === id) setSelectedId(null)
    try { await microMarketService.delete(id) } catch (e) { message.error(e.message || 'Delete failed') }
  }

  if (!canAccess) {
    return (
      <Result
        status="403"
        title="Reviewers only"
        subTitle="You need the reviewer capability to use the micro-market mapping tool."
      />
    )
  }

  return (
    <div className="mm-page">
      <MicroMarketSidebar
        areas={areas}
        selectedId={selectedId}
        loadingAreas={loadingAreas}
        loadingWarehouses={loadingWarehouses}
        warehouseCount={warehouses.length}
        showAreas={showAreas}
        onToggleAreas={() => setShowAreas(v => !v)}
        showPins={showPins}
        onTogglePins={() => setShowPins(v => !v)}
        onFocus={id => setFocusReq({ id })}
        onChangeMeta={changeMeta}
        onCommitMeta={commitMeta}
        onDelete={requestDelete}
      />
      <div className="mm-map">
        <MicroMarketMap
          initialFC={initialFC}
          warehouses={warehouses}
          showAreas={showAreas}
          showPins={showPins}
          onCreate={handleCreate}
          onUpdateGeometry={handleUpdateGeometry}
          onUserDelete={handleUserDelete}
          onSelect={handleSelect}
          focusReq={focusReq}
          removeId={removeId}
          onRemoved={onRemovedFromMap}
        />
        {!hasToken && (
          <div className="mm-banner warn">
            Set <code>VITE_MAPBOX_TOKEN</code> to load the map.
          </div>
        )}
      </div>
    </div>
  )
}
