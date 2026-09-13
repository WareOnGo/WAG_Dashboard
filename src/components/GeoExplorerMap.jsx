import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { Button } from 'antd'
import { AimOutlined, LoadingOutlined } from '@ant-design/icons'
import 'mapbox-gl/dist/mapbox-gl.css'
import { geoService, boundsToBbox, bboxContains, padBbox } from '../services/geoService'
import { EMPTY_FC } from '../utils/geoLayers'
import { prefersPreciseLocation, requestCurrentLocation } from '../utils/currentLocation'
import {
  warehousePopupHTML, osmPopupHTML, ownPopupHTML,
} from '../utils/geoPopups'
import {
  registerMapIcons,
  ensureCategoryIcon,
  warehouseIconId,
  ownIconExpression,
  availabilityExpression,
} from '../utils/geoIcons'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN


const OSM_SRC = 'osm-poi-src'
const OWN_SRC = 'own-poi-src'
const WH_SRC = 'warehouse-src'
const BASEMAPS = {
  map: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
}

const osmLayerId = (cat) => `osm-poi-${cat}`

/**
 * GeoExplorerMap — the map surface for POI plotting.
 *
 * Rendering uses GeoJSON sources plus one layer per category, NOT DOM markers.
 * A marker is a DOM node; at a few thousand POIs that stalls the browser, whereas
 * a circle layer is drawn on the GPU and stays smooth. Toggling a category is
 * then a `visibility` change on an already-loaded source — no refetch, no redraw
 * of anything else.
 *
 * Data is fetched per viewport. The requested bbox is padded beyond what is
 * visible so small pans don't trigger a request, and a fetch is skipped entirely
 * while the new viewport is still inside the last one.
 */
const GeoExplorerMap = ({
  enabledOsmCategories = [],
  showWarehouses = true,
  showOwnPoints = true,
  placingPoint = false,
  placementLocation = null,
  canEditPoint = () => false,
  onEditPoint,
  onUpdatePoint,
  onDeletePoint,
  onOpenWarehouse,
  onFetchWarehouse,
  onPlacingChange,
  onLoadingChange,
  onTruncated,
  onErrorChange,
  onReadyChange,
  onBusyChange,
  onNoticeChange,
  overlayOpen = false,
  refreshKey = 0,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const loadedRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [basemap, setBasemap] = useState('map')
  const [styleLoading, setStyleLoading] = useState(false)
  const styleRequestRef = useRef(null)
  const sourceDataRef = useRef({ osm: EMPTY_FC, own: EMPTY_FC, wh: EMPTY_FC })
  const forceRefreshRef = useRef(false)
  const [locating, setLocating] = useState(false)
  const locationRequestRef = useRef(0)
  const pendingLocationRef = useRef(null)
  const locationEstimateRef = useRef(null)
  const userLocationMarkerRef = useRef(null)
  const lastBboxRef = useRef({ osm: null, own: null, wh: null })
  const symbolOptsRef = useRef(null)
  const popupRef = useRef(null)
  const [moving, setMoving] = useState(null)
  const positionMarkerRef = useRef(null)
  const [center, setCenter] = useState({ lat: 12.95, lng: 77.60 })
  const [savingMove, setSavingMove] = useState(false)
  const [moveError, setMoveError] = useState('')
  const movingRef = useRef(null)
  movingRef.current = moving
  const requestVersionRef = useRef(0)
  const osmCategoriesRef = useRef('')
  const truncatedRef = useRef({ osm: false, wh: false })
  // Cursor inputs. Kept in refs because they are read from map event handlers
  // that are bound once and never see re-rendered state.
  const cursorRef = useRef({ fetching: false, hovering: false })
  // Handlers are called from popup DOM listeners that are bound once, so they
  // must read the latest callbacks rather than the ones captured at bind time.
  const handlersRef = useRef({})
  handlersRef.current = {
    onEditPoint, onUpdatePoint, onDeletePoint, onOpenWarehouse, onPlacingChange, onFetchWarehouse, onBusyChange, onReadyChange, onErrorChange, onNoticeChange,
  }
  // Read inside map event handlers, which close over their first render.
  const stateRef = useRef({ enabledOsmCategories, showWarehouses, showOwnPoints, placingPoint, canEdit: canEditPoint })
  stateRef.current = { enabledOsmCategories, showWarehouses, showOwnPoints, placingPoint, canEdit: canEditPoint }

  const cancelLocating = useCallback(() => {
    locationRequestRef.current += 1
    if (pendingLocationRef.current || locationEstimateRef.current) {
      pendingLocationRef.current?.cancel?.()
      pendingLocationRef.current = null
      locationEstimateRef.current = null
      handlersRef.current.onNoticeChange?.(null)
    }
    setLocating(false)
  }, [])

  const locate = (precise = prefersPreciseLocation()) => {
    if (locating) { cancelLocating(); return }
    const notice = (message, type = 'warning', actions, compactMessage) => handlersRef.current.onNoticeChange?.({ message, type, actions, compactMessage })
    if (!window.isSecureContext) { notice('Location needs a secure connection. Open this page using HTTPS.'); return }
    if (!navigator.geolocation) { notice('Location is unavailable in this browser. You can still position the pin on the map.'); return }
    const map = mapRef.current
    if (!map || !loadedRef.current || savingMove) return
    const request = ++locationRequestRef.current
    locationEstimateRef.current = null
    const pin = positionMarkerRef.current
    const isCurrent = () => request === locationRequestRef.current && mapRef.current === map && pin === positionMarkerRef.current
    setLocating(true)
    notice(precise ? 'Trying a more precise location… This can take up to 12 seconds.' : 'Finding your location… Allow location access if prompted.', 'info')
    const pending = { cancel: null }
    pendingLocationRef.current = pending
    const fail = (error) => {
      if (!isCurrent()) return
      pendingLocationRef.current = null
      setLocating(false)
      notice(error.code === 1
        ? 'Location permission is off. Allow location in your browser’s site settings, then try again.'
        : error.code === 3
          ? 'Your browser did not return a location. Check location access, or position the pin manually.'
          : 'Your browser’s location service is unavailable. Check system location settings and your connection.', 'warning',
      error.code !== 1 && !precise ? [{ label: 'Try precise location', onClick: () => locate(true) }] : undefined)
    }
    pending.cancel = requestCurrentLocation({
      precise,
      onSuccess: ({ coords }) => {
        // A cancelled request or a manually repositioned pin must not jump later.
        if (!isCurrent()) return
        pendingLocationRef.current = null
        setLocating(false)
        const at = { lat: coords.latitude, lng: coords.longitude }
        const accuracy = Math.max(1, Math.round(coords.accuracy))
        const distance = accuracy >= 1000 ? `${(accuracy / 1000).toFixed(1)} km` : `${accuracy} m`
        const applyEstimate = () => {
          if (!isCurrent()) return
          locationEstimateRef.current = null
          userLocationMarkerRef.current?.remove()
          const dot = document.createElement('div')
          dot.className = 'geo-user-location'
          dot.setAttribute('role', 'img')
          dot.setAttribute('aria-label', `Estimated location, reported accuracy ${distance}`)
          userLocationMarkerRef.current = new mapboxgl.Marker({ element: dot }).setLngLat(at).addTo(map)
          if (pin) {
            pin.setLngLat(at)
            setCenter(at)
          }
          // Finish at street level and preserve an already closer view. easeTo
          // pans directly without flyTo's intermediate zoom-out over distance.
          map.easeTo({ center: [at.lng, at.lat], zoom: Math.max(map.getZoom(), 16), duration: 800 })
          notice(`Location estimate (±${distance}).${pin ? ' Check the pin before confirming.' : ''}`, accuracy > 100 ? 'warning' : 'info', undefined,
            `Estimate ±${distance}.${pin ? ' Check pin.' : ''}`)
        }
        // Network/ISP estimates can point to another city. Do not silently move
        // the camera or a draft when the provider reports over 1 km uncertainty.
        if (accuracy > 1000) {
          locationEstimateRef.current = { request }
          notice(`Only a broad estimate is available (±${distance}). It may point to another city.`, 'warning', [
            { label: pin ? 'Use estimate' : 'Show area', onClick: applyEstimate },
            ...(!precise ? [{ label: 'Try precise', onClick: () => locate(true) }] : []),
          ], `Broad estimate ±${distance}.\nMay be another city.`)
        } else applyEstimate()
      },
      onError: fail,
    })
  }

  const switchBasemap = (next) => {
    const map = mapRef.current
    if (!map || !loadedRef.current || next === basemap || locating || savingMove) return
    loadedRef.current = false
    setMapReady(false)
    setStyleLoading(true)
    setBasemap(next)
    requestVersionRef.current += 1
    handlersRef.current.onReadyChange?.(false)
    const request = { previous: basemap, recovering: false, timer: null }
    styleRequestRef.current = request
    const recover = () => {
      if (styleRequestRef.current !== request) return
      clearTimeout(request.timer)
      if (request.recovering) {
        styleRequestRef.current = null
        setStyleLoading(false)
        handlersRef.current.onErrorChange?.('The map could not load. Check your connection and reload the page.')
        return
      }
      request.recovering = true
      setBasemap(request.previous)
      handlersRef.current.onNoticeChange?.({ type: 'warning', message: `${next === 'satellite' ? 'Satellite' : 'Map'} view could not load. Returning to the previous view. You can try again.` })
      request.timer = setTimeout(recover, 15000)
      try { map.setStyle(BASEMAPS[request.previous], { diff: false }) } catch { recover() }
    }
    request.recover = recover
    request.timer = setTimeout(recover, 15000)
    // A full style load gives one reliable rehydration event, including when
    // retrying a failed switch back to the same style URL.
    try { map.setStyle(BASEMAPS[next], { diff: false }) } catch { recover() }
  }

  /**
   * Resolve the canvas cursor from all of its inputs at once.
   *
   * Three concerns want to set the cursor — placing a point, hovering a feature,
   * and waiting on a viewport fetch — and setting it directly from each meant
   * whichever handler ran last won. Priority here is deliberate: placing is a
   * mode the user explicitly entered, so it outranks everything; a pending fetch
   * outranks hover because it explains why the map looks empty.
   *
   * `progress` rather than `wait`: the map stays pannable while data loads, and
   * `wait` would imply it does not.
   */
  const applyCursor = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    // Mapbox sets its own grab/grabbing cursor while the map is being dragged.
    // Overriding that mid-drag makes panning feel broken, so leave it alone and
    // let the moveend-triggered refresh reassert the right cursor afterwards.
    if (map.isMoving()) return

    const { fetching, hovering } = cursorRef.current
    const canvas = map.getCanvas()
    if (stateRef.current.placingPoint) canvas.style.cursor = 'crosshair'
    else if (fetching) canvas.style.cursor = 'progress'
    else if (hovering) canvas.style.cursor = 'pointer'
    else canvas.style.cursor = ''
  }, [])

  /**
   * Create a category's symbol layer if it does not exist yet.
   *
   * Categories are data, not configuration — whatever the import puts in the
   * database appears in the sidebar, so a layer has to be able to appear for a
   * category this file has never heard of. Unknown ones get a generic grey
   * badge rather than no layer at all, which would leave a checkbox that
   * silently does nothing.
   */
  const ensureCategoryLayer = useCallback((cat) => {
    const map = mapRef.current
    if (!map || map.getLayer(osmLayerId(cat)) || !symbolOptsRef.current) return
    const { layout, paint } = symbolOptsRef.current
    map.addLayer({
      id: osmLayerId(cat),
      type: 'symbol',
      source: OSM_SRC,
      filter: ['==', ['get', 'category'], cat],
      layout: { ...layout, 'icon-image': ensureCategoryIcon(map, cat), visibility: 'none' },
      paint,
    }, map.getLayer('warehouse-dots') ? 'warehouse-dots' : undefined)
  }, [])

  /** Fetch whichever layers are visible and whose cached bbox no longer covers the view. */
  const refreshData = useCallback(async (force = false) => {
    const map = mapRef.current
    if (!map || !loadedRef.current) {
      if (force) forceRefreshRef.current = true
      return
    }
    const { enabledOsmCategories: cats, showWarehouses: wh, showOwnPoints: own } = stateRef.current

    const visible = boundsToBbox(map.getBounds())
    const bbox = padBbox(visible)
    const categoryKey = [...cats].sort().join(',')
    const version = ++requestVersionRef.current
    const jobs = []
    const fetchLayer = (key, source, request) => {
      jobs.push(request.then(fc => {
        // A slow response must never overwrite a newer viewport or selection.
        if (version !== requestVersionRef.current || mapRef.current !== map) return
        sourceDataRef.current[key] = fc
        map.getSource(source)?.setData(fc)
        lastBboxRef.current[key] = bbox
        truncatedRef.current[key] = !!fc.truncated
        if (key === 'osm') osmCategoriesRef.current = categoryKey
      }))
    }
    if (cats.length && (force || categoryKey !== osmCategoriesRef.current || !bboxContains(lastBboxRef.current.osm, visible))) {
      fetchLayer('osm', OSM_SRC, geoService.osmPois({ bbox, categories: cats }))
    } else if (!cats.length) {
      sourceDataRef.current.osm = EMPTY_FC
      map.getSource(OSM_SRC)?.setData(EMPTY_FC)
      lastBboxRef.current.osm = null
      osmCategoriesRef.current = ''
      truncatedRef.current.osm = false
    }
    if (own && (force || !bboxContains(lastBboxRef.current.own, visible))) fetchLayer('own', OWN_SRC, geoService.points({ bbox }))
    if (wh && (force || !bboxContains(lastBboxRef.current.wh, visible))) fetchLayer('wh', WH_SRC, geoService.warehouses({ bbox }))
    const updateTruncated = () => onTruncated?.((cats.length > 0 && truncatedRef.current.osm) || (wh && truncatedRef.current.wh))
    if (!jobs.length) {
      onLoadingChange?.(false)
      cursorRef.current.fetching = false
      updateTruncated()
      applyCursor()
      return
    }
    onLoadingChange?.(true)
    cursorRef.current.fetching = true
    applyCursor()
    const results = await Promise.allSettled(jobs)
    if (version !== requestVersionRef.current || mapRef.current !== map) return
    onErrorChange?.(results.some(result => result.status === 'rejected') ? 'Some places could not load. Check your connection and retry.' : null)
    updateTruncated()
    onLoadingChange?.(false)
    cursorRef.current.fetching = false
    applyCursor()
  }, [onLoadingChange, onTruncated, onErrorChange, applyCursor])

  // --- Map setup (once) ---
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    if (!mapboxgl.accessToken) return

    let map
    try { map = new mapboxgl.Map({
      container: containerRef.current,
      style: BASEMAPS.map,
      center: [77.60, 12.95],
      zoom: 10,
    }) } catch {
      handlersRef.current.onErrorChange?.('The map could not start. Check your browser and reload the page.')
      return
    }
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    // The pane changes size independently of the window (drawers, rotation).
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)
    map.getCanvas().setAttribute('aria-label', 'Map. Use arrow keys to pan and plus or minus to zoom.')

    // setStyle discards sources, images and layers. Rebuild them from cached
    // data on every style load, while binding interaction handlers only once.
    map.on('style.load', () => {
      // The base style ships its own POI labels from a different dataset; leaving
      // them on shows two contradictory sets of petrol stations.
      for (const id of ['poi-label', 'poi-scalerank1', 'poi-scalerank2']) {
        if (map.getStyle().layers?.some((l) => l.id === id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
        }
      }

      map.addSource(OSM_SRC, { type: 'geojson', data: sourceDataRef.current.osm })
      map.addSource(OWN_SRC, { type: 'geojson', data: sourceDataRef.current.own })
      map.addSource(WH_SRC, { type: 'geojson', data: sourceDataRef.current.wh })

      // Draw and register the badge images before any layer references them.
      registerMapIcons(map)

      // Shared across every symbol layer here.
      //
      // icon-allow-overlap is essential: Mapbox hides colliding symbols by
      // default, so in a dense area most POIs would silently vanish and the map
      // would understate how much is there.
      //
      // icon-emissive-strength for the same reason circles needed it — Standard
      // v3 lights custom layers, and without it a dark preset renders the badges
      // almost black regardless of their actual colour.
      const symbolLayout = {
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.85, 12, 1, 16, 1.2],
      }
      const symbolPaint = { 'icon-emissive-strength': 1 }

      // Category layers are created lazily by ensureCategoryLayer() as they are
      // first switched on, because the category list comes from the database
      // rather than from this file.
      symbolOptsRef.current = { layout: symbolLayout, paint: symbolPaint }

      // Warehouses sit above reference data — they are the reason for the page.
      // An icon image cannot be tinted per feature, so availability picks one of
      // three pre-rendered badges instead of driving a colour expression.
      map.addLayer({
        id: 'warehouse-dots',
        type: 'symbol',
        source: WH_SRC,
        layout: {
          ...symbolLayout,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.9, 12, 1.1, 16, 1.3],
          'icon-image': [
            'match', availabilityExpression,
            'available', warehouseIconId('available'),
            'unavailable', warehouseIconId('unavailable'),
            warehouseIconId('unknown'),
          ],
        },
        paint: symbolPaint,
      })

      // Our own points on top of everything.
      map.addLayer({
        id: 'own-poi-dots',
        type: 'symbol',
        source: OWN_SRC,
        layout: {
          ...symbolLayout,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.95, 12, 1.15, 16, 1.35],
          'icon-image': ownIconExpression,
        },
        paint: symbolPaint,
      })

      for (const cat of stateRef.current.enabledOsmCategories) {
        ensureCategoryLayer(cat)
        map.setLayoutProperty(osmLayerId(cat), 'visibility', 'visible')
      }
      map.setLayoutProperty('warehouse-dots', 'visibility', stateRef.current.showWarehouses ? 'visible' : 'none')
      map.setLayoutProperty('own-poi-dots', 'visibility', stateRef.current.showOwnPoints ? 'visible' : 'none')
      if (movingRef.current) map.setFilter('own-poi-dots', ['!=', ['get', 'id'], movingRef.current.id])
      clearTimeout(styleRequestRef.current?.timer)
      styleRequestRef.current = null
      loadedRef.current = true
      setMapReady(true)
      setStyleLoading(false)
      handlersRef.current.onReadyChange?.(true)
      const force = forceRefreshRef.current
      forceRefreshRef.current = false
      refreshData(force)
    })

    map.on('load', () => {
      // Computed per click rather than captured once: category layers are added
      // lazily, so a list built here would miss every layer created later.
      const clickableLayers = () => map.getStyle().layers
        .map((l) => l.id)
        .filter((id) => id === 'warehouse-dots' || id === 'own-poi-dots' || id.startsWith('osm-poi-'))

      /** One popup at a time, so clicking around does not litter the map. */
      const showPopup = (lngLat, html) => {
        popupRef.current?.remove()
        const popup = new mapboxgl.Popup({
          offset: 14,
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px',
          className: 'geo-popup',
        })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map)
        popupRef.current = popup
        handlersRef.current.onBusyChange?.(true)
        popup.getElement().setAttribute('role', 'region')
        popup.getElement().setAttribute('aria-label', 'Place details')
        popup.getElement().querySelector('.mapboxgl-popup-close-button')?.setAttribute('aria-label', 'Close place details')
        popup.on('close', () => handlersRef.current.onBusyChange?.(false))
        return popup
      }

      const openPointForm = (at, existing = null) => {
        popupRef.current?.remove()
        handlersRef.current.onEditPoint?.(at, existing)
      }
      const startMove = (props, coords) => {
        popupRef.current?.remove()
        map.setFilter('own-poi-dots', ['!=', ['get', 'id'], props.id])
        setMoving({ ...props, coords })
        setMoveError('')
        handlersRef.current.onBusyChange?.(true)
      }

      map.on('click', (e) => {
        if (stateRef.current.placingPoint || movingRef.current) {
          cancelLocating()
          positionMarkerRef.current?.setLngLat(e.lngLat)
          setCenter({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          return
        }
        if (!loadedRef.current) return
        // Expand touch hit testing, then choose the nearest rendered feature.
        const radius = e.originalEvent?.pointerType === 'touch' || e.originalEvent?.type?.startsWith('touch') ? 22 : 10
        const hits = map.queryRenderedFeatures([[e.point.x - radius, e.point.y - radius], [e.point.x + radius, e.point.y + radius]], { layers: clickableLayers() })
        hits.sort((a, b) => map.project(a.geometry.coordinates).dist(e.point) - map.project(b.geometry.coordinates).dist(e.point))
        if (!hits.length) return
        const feature = hits[0]
        const props = feature.properties
        const layerId = feature.layer.id
        const coords = feature.geometry?.coordinates?.slice() ?? [e.lngLat.lng, e.lngLat.lat]

        let html
        if (layerId === 'warehouse-dots') html = warehousePopupHTML(props)
        // The menu is hidden for other people's points, but the server refuses
        // the mutation regardless — this only removes a control that would fail.
        else if (layerId === 'own-poi-dots') html = ownPopupHTML(props, stateRef.current.canEdit(props.createdBy))
        else html = osmPopupHTML(props)

        const popup = showPopup(coords, html)

        /**
         * Bind the popup's buttons. Called again after any setHTML(), because
         * replacing the markup discards the listeners bound to the old nodes.
         */
        const bindActions = () => {
          const el = popup.getElement()
          if (!el) return
          const close = el.querySelector('.mapboxgl-popup-close-button')
          if (close) {
            close.setAttribute('aria-label', 'Close place details')
            close.parentElement.prepend(close)
          }

          el.querySelector('[data-action="open-warehouse"]')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget
            btn.disabled = true
            btn.style.opacity = '0.75'
            btn.innerHTML = '<span class="geo-spinner"></span>Opening'
            try {
              await handlersRef.current.onOpenWarehouse?.(Number(btn.dataset.id))
            } finally {
              btn.disabled = false
              btn.style.opacity = '1'
              btn.textContent = 'Open details'
            }
          })

          const menu = el.querySelector('[data-role="menu"]')
          el.querySelector('[data-action="toggle-menu"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation()
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
            ev.currentTarget.setAttribute('aria-expanded', String(menu.style.display === 'block'))
          })

          el.querySelector('[data-action="edit-point"]')?.addEventListener('click', () => {
            // Replaces this popup, so the point being edited keeps its position.
            openPointForm({ lat: coords[1], lng: coords[0] }, props)
          })

          el.querySelector('[data-action="move-point"]')?.addEventListener('click', () => {
            startMove(props, coords)
          })

          el.querySelector('[data-action="delete-point"]')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget
            if (btn.dataset.confirm !== 'true') {
              btn.dataset.confirm = 'true'
              btn.textContent = 'Confirm delete'
              return
            }
            btn.disabled = true
            btn.style.opacity = '0.75'
            btn.innerHTML = '<span class="geo-spinner"></span>Deleting'
            try {
              await handlersRef.current.onDeletePoint?.(btn.dataset.id)
              popup.remove()
            } catch (err) {
              btn.disabled = false
              btn.style.opacity = '1'
              btn.textContent = err?.message?.includes('only change') ? 'Not yours to delete' : 'Delete failed — retry'
            }
          })
        }
        bindActions()

        // Second pass: fill in the fields the viewport payload omits. Guarded on
        // the popup still being open, since the user may have clicked elsewhere
        // while the request was in flight.
        if (layerId === 'warehouse-dots' && handlersRef.current.onFetchWarehouse) {
          handlersRef.current.onFetchWarehouse(Number(props.id))
            .then((full) => {
              if (popupRef.current !== popup || !popup.isOpen()) return
              popup.setHTML(warehousePopupHTML(props, full))
              bindActions()
            })
            .catch(() => {
              if (popupRef.current !== popup || !popup.isOpen()) return
              popup.setHTML(warehousePopupHTML(props, null, true))
              bindActions()
            })
        }
      })

      // One delegated handler instead of per-layer listeners, for the same reason.
      map.on('mousemove', (e) => {
        if (!loadedRef.current) return
        const over = map.queryRenderedFeatures(e.point, { layers: clickableLayers() }).length > 0
        if (over !== cursorRef.current.hovering) {
          cursorRef.current.hovering = over
          applyCursor()
        }
      })
    })

    // Expression/style failures arrive here rather than as exceptions.
    map.on('error', (e) => {
      if (styleRequestRef.current) { styleRequestRef.current.recover(); return }
      console.error('[GeoExplorerMap]', e?.error?.message || e)
      if (!loadedRef.current) handlersRef.current.onErrorChange?.('The map could not load. Check your connection and reload the page.')
    })

    map.on('moveend', () => {
      applyCursor()
      refreshData(false)
    })

    return () => {
      locationRequestRef.current += 1
      pendingLocationRef.current?.cancel?.()
      pendingLocationRef.current = null
      userLocationMarkerRef.current?.remove()
      clearTimeout(styleRequestRef.current?.timer)
      styleRequestRef.current = null
      popupRef.current?.remove()
      resizeObserver.disconnect()
      handlersRef.current.onReadyChange?.(false)
      map.remove()
      mapRef.current = null
      loadedRef.current = false
    }
    // Intentionally mount-only: the map instance must outlive prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Toggle OSM category visibility (no refetch when data is already loaded) ---
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return

    for (const cat of enabledOsmCategories) ensureCategoryLayer(cat)

    // Hide every category layer that exists but is no longer selected.
    for (const layer of map.getStyle().layers) {
      if (!layer.id.startsWith('osm-poi-')) continue
      const cat = layer.id.slice('osm-poi-'.length)
      map.setLayoutProperty(layer.id, 'visibility', enabledOsmCategories.includes(cat) ? 'visible' : 'none')
    }
    refreshData(false)
  }, [enabledOsmCategories, ensureCategoryLayer, refreshData])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    if (map.getLayer('warehouse-dots')) {
      map.setLayoutProperty('warehouse-dots', 'visibility', showWarehouses ? 'visible' : 'none')
    }
    if (map.getLayer('own-poi-dots')) {
      map.setLayoutProperty('own-poi-dots', 'visibility', showOwnPoints ? 'visible' : 'none')
    }
    refreshData(false)
  }, [showWarehouses, showOwnPoints, refreshData])

  // Parent bumps refreshKey after creating/deleting a point.
  useEffect(() => {
    if (refreshKey) refreshData(true)
  }, [refreshKey, refreshData])

  useEffect(() => {
    applyCursor()
    if (placingPoint || overlayOpen) popupRef.current?.remove()
  }, [placingPoint, overlayOpen, applyCursor])

  // Map taps and marker drags only update coordinates. The explicit current-
  // location action is the placement control that also moves the camera.
  useEffect(() => {
    const map = mapRef.current
    if (!map || (!placingPoint && !moving)) return
    const at = moving ? { lng: moving.coords[0], lat: moving.coords[1] } : (placementLocation || map.getCenter())
    const marker = new mapboxgl.Marker({ color: '#bc8cff', draggable: true, scale: 1.3 })
      .setLngLat(at).addTo(map)
    positionMarkerRef.current = marker
    marker.getElement().classList.add('geo-position-marker')
    marker.getElement().setAttribute('aria-label', 'Selected pin location. Drag to reposition, or tap the map.')
    const update = () => { cancelLocating(); const point = marker.getLngLat(); setCenter({ lat: point.lat, lng: point.lng }) }
    update()
    marker.on('drag', update)
    return () => { cancelLocating(); marker.remove(); positionMarkerRef.current = null }
  }, [placingPoint, moving, placementLocation, cancelLocating])

  const cancelPosition = useCallback(() => {
    if (savingMove) return
    cancelLocating()
    handlersRef.current.onNoticeChange?.(null)
    setMoving(null)
    setMoveError('')
    onPlacingChange?.(false)
    onBusyChange?.(false)
    if (mapRef.current?.getLayer('own-poi-dots')) mapRef.current.setFilter('own-poi-dots', null)
  }, [savingMove, onPlacingChange, onBusyChange, cancelLocating])

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'Escape') {
        if (placingPoint || moving) cancelPosition()
        else popupRef.current?.remove()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placingPoint, moving, cancelPosition])

  const confirmPosition = async () => {
    const at = positionMarkerRef.current?.getLngLat()
    if (!at || locating || savingMove) return
    cancelLocating()
    handlersRef.current.onNoticeChange?.(null)
    if (!moving) {
      onPlacingChange?.(false)
      onEditPoint?.({ lat: at.lat, lng: at.lng })
      return
    }
    setSavingMove(true)
    try {
      await onUpdatePoint?.(moving.id, { lat: at.lat, lng: at.lng })
      setMoving(null)
      onBusyChange?.(false)
      if (mapRef.current?.getLayer('own-poi-dots')) mapRef.current.setFilter('own-poi-dots', null)
    } catch (err) { setMoveError(err?.message || 'Could not move the point. Try again.') }
    finally { setSavingMove(false) }
  }

  if (!mapboxgl.accessToken) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)' }}>
        The map is unavailable. Please contact your administrator.
      </div>
    )
  }

  // Absolutely positioned rather than height:100% — the parent is a flex item,
  // and percentage heights through a flex chain resolve inconsistently, which is
  // what leaves a strip of background under the canvas.
  return <>
    <div ref={containerRef} className="geo-map-surface" style={{ position: 'absolute', inset: 0 }} />
    <div className="geo-map-tools" role="group" aria-label="Map controls">
      <div className="geo-basemap-switch" role="group" aria-label="Map view">
        {['map', 'satellite'].map(view => <button key={view} type="button"
          aria-pressed={basemap === view} disabled={!mapReady || styleLoading || savingMove || locating}
          onClick={() => switchBasemap(view)}>
          {styleLoading && basemap === view && <LoadingOutlined aria-hidden="true" />}
          {view === 'map' ? 'Map' : 'Satellite'}
        </button>)}
      </div>
      <button type="button" className="geo-locate-button" onClick={() => locate()}
        disabled={!mapReady || styleLoading || savingMove}
        aria-label={locating ? 'Cancel finding location' : 'Use current location'}
        title={locating ? 'Finding your location… Click to cancel' : (placingPoint || moving) ? 'Place pin at your current location' : 'Go to your current location'}>
        {locating ? <LoadingOutlined aria-hidden="true" /> : <AimOutlined aria-hidden="true" />}
        <span className="geo-locate-label">{locating ? 'Locating…' : 'My location'}</span>
      </button>
      <span className="geo-sr-only" role="status">{locating ? 'Finding your location. Allow location access if prompted.' : styleLoading ? 'Loading map view…' : ''}</span>
    </div>
    {(placingPoint || moving) && <>
      <div className="geo-position-hint" role="status"><strong>{moving ? `Move ${moving.name}` : 'Step 1 of 2 · Position your pin'}</strong><span>Tap the map, drag the pin, or use current location.</span></div>
      <div className="geo-position-bar">
        <span className="geo-position-coords">{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</span>
        {moveError && <span role="alert" className="geo-position-error">{moveError}</span>}
        <div><Button disabled={savingMove} onClick={cancelPosition}>Cancel</Button><Button type="primary" loading={savingMove} disabled={locating} onClick={confirmPosition}>{moving ? 'Save location' : 'Use this location'}</Button></div>
      </div>
    </>}
  </>
}

export default GeoExplorerMap
