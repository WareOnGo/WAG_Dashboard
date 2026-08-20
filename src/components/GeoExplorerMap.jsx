import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { geoService, boundsToBbox, bboxContains, padBbox } from '../services/geoService'
import { EMPTY_FC } from '../utils/geoLayers'
import {
  warehousePopupHTML, osmPopupHTML, ownPopupHTML, pointFormHTML, esc as escHtml,
} from '../utils/geoPopups'
import {
  registerMapIcons,
  ensureCategoryIcon,
  warehouseIconId,
  ownIconExpression,
  OWN_POINT_COLOR,
  moveHandleSvg,
  poiCategoryGlyph,
  availabilityExpression,
} from '../utils/geoIcons'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN


const OSM_SRC = 'osm-poi-src'
const OWN_SRC = 'own-poi-src'
const WH_SRC = 'warehouse-src'

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
  canEditPoint = () => false,
  onCreatePoint,
  onUpdatePoint,
  onDeletePoint,
  onOpenWarehouse,
  onFetchWarehouse,
  onPlacingChange,
  onLoadingChange,
  onTruncated,
  refreshKey = 0,
}) => {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const loadedRef = useRef(false)
  const lastBboxRef = useRef({ osm: null, own: null, wh: null })
  const symbolOptsRef = useRef(null)
  const popupRef = useRef(null)
  // The draggable handle and toolbar used while repositioning a point, so both
  // can be torn down if the component unmounts mid-move.
  const moveMarkerRef = useRef(null)
  const moveBarRef = useRef(null)
  // Cursor inputs. Kept in refs because they are read from map event handlers
  // that are bound once and never see re-rendered state.
  const cursorRef = useRef({ fetching: false, hovering: false })
  // Handlers are called from popup DOM listeners that are bound once, so they
  // must read the latest callbacks rather than the ones captured at bind time.
  const handlersRef = useRef({})
  handlersRef.current = {
    onCreatePoint, onUpdatePoint, onDeletePoint, onOpenWarehouse, onPlacingChange, onFetchWarehouse,
  }
  // Read inside map event handlers, which close over their first render.
  const stateRef = useRef({ enabledOsmCategories, showWarehouses, showOwnPoints, placingPoint, canEdit: canEditPoint })
  stateRef.current = { enabledOsmCategories, showWarehouses, showOwnPoints, placingPoint, canEdit: canEditPoint }

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
    })
  }, [])

  /** Fetch whichever layers are visible and whose cached bbox no longer covers the view. */
  const refreshData = useCallback(async (force = false) => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const { enabledOsmCategories: cats, showWarehouses: wh, showOwnPoints: own } = stateRef.current

    const visible = boundsToBbox(map.getBounds())
    const bbox = padBbox(visible)
    const jobs = []
    let truncated = false

    if (cats.length && (force || !bboxContains(lastBboxRef.current.osm, visible))) {
      jobs.push(
        geoService.osmPois({ bbox, categories: cats })
          .then((fc) => {
            map.getSource(OSM_SRC)?.setData(fc)
            lastBboxRef.current.osm = bbox
            if (fc.truncated) truncated = true
          }),
      )
    } else if (!cats.length) {
      map.getSource(OSM_SRC)?.setData(EMPTY_FC)
      lastBboxRef.current.osm = null
    }

    if (own && (force || !bboxContains(lastBboxRef.current.own, visible))) {
      jobs.push(
        geoService.points({ bbox })
          .then((fc) => { map.getSource(OWN_SRC)?.setData(fc); lastBboxRef.current.own = bbox }),
      )
    }

    if (wh && (force || !bboxContains(lastBboxRef.current.wh, visible))) {
      jobs.push(
        geoService.warehouses({ bbox })
          .then((fc) => {
            map.getSource(WH_SRC)?.setData(fc)
            lastBboxRef.current.wh = bbox
            if (fc.truncated) truncated = true
          }),
      )
    }

    if (!jobs.length) return
    onLoadingChange?.(true)
    cursorRef.current.fetching = true
    applyCursor()
    try {
      // allSettled: one failing layer must not blank the others.
      await Promise.allSettled(jobs)
      onTruncated?.(truncated)
    } finally {
      onLoadingChange?.(false)
      cursorRef.current.fetching = false
      applyCursor()
    }
  }, [onLoadingChange, onTruncated, applyCursor])

  // --- Map setup (once) ---
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    if (!mapboxgl.accessToken) return

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/rs-wareongo/cmmtpb32t002801r05lyzbea2',
      center: [77.60, 12.95],
      zoom: 10,
    })
    mapRef.current = map
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // The base style ships its own POI labels from a different dataset; leaving
      // them on shows two contradictory sets of petrol stations.
      for (const id of ['poi-label', 'poi-scalerank1', 'poi-scalerank2']) {
        if (map.getStyle().layers?.some((l) => l.id === id)) {
          map.setLayoutProperty(id, 'visibility', 'none')
        }
      }

      map.addSource(OSM_SRC, { type: 'geojson', data: EMPTY_FC })
      map.addSource(OWN_SRC, { type: 'geojson', data: EMPTY_FC })
      map.addSource(WH_SRC, { type: 'geojson', data: EMPTY_FC })

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
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 12, 0.8, 16, 1],
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
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 12, 0.9, 16, 1.15],
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
          'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.65, 12, 0.95, 16, 1.2],
          'icon-image': ownIconExpression,
        },
        paint: symbolPaint,
      })

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
          // No close button: it renders in the same corner as the point's own
          // action menu and the two collide. Clicking the map dismisses the
          // popup, and forms carry an explicit Cancel — the same arrangement
          // MapView already uses.
          closeButton: false,
          closeOnClick: true,
          maxWidth: '300px',
          className: 'geo-popup',
        })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map)
        popupRef.current = popup
        return popup
      }

      /**
       * Open the point form and wire it up. Serves both create and edit, since
       * the only difference is whether an existing record is passed in and which
       * handler the submit calls.
       */
      const openPointForm = (at, existing = null) => {
        const popup = showPopup([at.lng, at.lat], pointFormHTML(at, existing))
        const el = popup.getElement()
        const form = el.querySelector('[data-form="point"]')
        const errorBox = el.querySelector('[data-role="error"]')
        el.querySelector('[data-action="cancel-point"]')?.addEventListener('click', () => popup.remove())

        form?.addEventListener('submit', async (ev) => {
          ev.preventDefault()
          const submit = form.querySelector('[data-action="save-point"]')
          const data = Object.fromEntries(new FormData(form))
          submit.disabled = true
          submit.style.opacity = '0.75'
          submit.innerHTML = '<span class="geo-spinner"></span>Saving'
          try {
            if (existing) await handlersRef.current.onUpdatePoint?.(existing.id, data)
            else await handlersRef.current.onCreatePoint?.({ ...data, lat: at.lat, lng: at.lng })
            popup.remove()
          } catch (err) {
            // Reported inside the popup rather than as a toast: the failure
            // belongs next to the form the user is still looking at.
            errorBox.textContent = err?.message || 'Could not save the point'
            errorBox.style.display = 'block'
            errorBox.classList.add('geo-reveal')
            submit.disabled = false
            submit.style.opacity = '1'
            submit.textContent = 'Save'
          }
        })
        return popup
      }

      /**
       * Enter move mode: swap the popup for instructions and drop a draggable
       * marker on the point. The marker, not the map, is what moves — dragging
       * the map itself would be ambiguous with panning.
       */
      const startMove = (props, coords) => {
        popupRef.current?.remove()

        // Hide the point from its layer for the duration. Without this the
        // original badge stays painted where it was, so the user sees two
        // things and cannot tell which one they are actually moving.
        map.setFilter('own-poi-dots', ['!=', ['get', 'id'], props.id])

        // The draggable handle IS the point's own badge, ringed — dragging a
        // different-looking marker makes it feel like you are positioning some
        // other object. Ring and badge are one SVG, so nothing about its shape
        // depends on CSS box sizing of an element Mapbox styles itself.
        const HANDLE_PX = 40
        const handle = document.createElement('div')
        handle.className = 'geo-move-handle'
        handle.style.width = `${HANDLE_PX}px`
        handle.style.height = `${HANDLE_PX}px`
        handle.innerHTML = moveHandleSvg(OWN_POINT_COLOR, poiCategoryGlyph(props.category), HANDLE_PX)

        const marker = new mapboxgl.Marker({ element: handle, draggable: true, anchor: 'center' })
          .setLngLat(coords)
          .addTo(map)
        moveMarkerRef.current = marker

        // A compact bar pinned to the bottom of the map, rather than a panel
        // anchored to the point: the area around the point is exactly what the
        // user needs to see while aiming.
        const bar = document.createElement('div')
        bar.className = 'geo-move-bar geo-reveal'
        bar.innerHTML = `
          <div class="geo-move-text">
            <strong>Moving ${escHtml(props.name)}</strong>
            <span data-role="coords"></span>
          </div>
          <div class="geo-move-actions">
            <button type="button" data-action="cancel-move">Cancel</button>
            <button type="button" data-action="save-move">Save</button>
          </div>`
        map.getContainer().appendChild(bar)
        moveBarRef.current = bar

        const coordBox = bar.querySelector('[data-role="coords"]')
        const showCoords = () => {
          const { lat, lng } = marker.getLngLat()
          coordBox.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        }
        showCoords()
        marker.on('drag', showCoords)

        const end = () => {
          marker.remove()
          bar.remove()
          moveMarkerRef.current = null
          moveBarRef.current = null
          // Restore the layer so the point reappears — the refresh that follows
          // a successful save will bring back its updated position.
          if (map.getLayer('own-poi-dots')) map.setFilter('own-poi-dots', null)
        }

        bar.querySelector('[data-action="cancel-move"]').addEventListener('click', end)

        bar.querySelector('[data-action="save-move"]').addEventListener('click', async (ev) => {
          const btn = ev.currentTarget
          const { lat, lng } = marker.getLngLat()
          btn.disabled = true
          btn.innerHTML = '<span class="geo-spinner"></span>Saving'
          try {
            await handlersRef.current.onUpdatePoint?.(props.id, { lat, lng })
            end()
          } catch (err) {
            coordBox.textContent = err?.message || 'Could not move the point'
            coordBox.style.color = '#ef4444'
            btn.disabled = false
            btn.textContent = 'Save'
          }
        })

        // Escape cancels, which is what a user reaches for to back out.
        const onKey = (ev) => {
          if (ev.key !== 'Escape') return
          end()
          window.removeEventListener('keydown', onKey)
        }
        window.addEventListener('keydown', onKey)
      }

      map.on('click', (e) => {
        // Placing mode: the form opens where the click landed, so the location
        // being named stays visible while it is named.
        if (stateRef.current.placingPoint) {
          openPointForm({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          handlersRef.current.onPlacingChange?.(false)
          return
        }

        const hits = map.queryRenderedFeatures(e.point, { layers: clickableLayers() })
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

          el.querySelector('[data-action="open-warehouse"]')?.addEventListener('click', (ev) => {
            const btn = ev.currentTarget
            btn.disabled = true
            btn.style.opacity = '0.75'
            btn.innerHTML = '<span class="geo-spinner"></span>Opening'
            handlersRef.current.onOpenWarehouse?.(Number(btn.dataset.id))
          })

          const menu = el.querySelector('[data-role="menu"]')
          el.querySelector('[data-action="toggle-menu"]')?.addEventListener('click', (ev) => {
            ev.stopPropagation()
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block'
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
        const over = map.queryRenderedFeatures(e.point, { layers: clickableLayers() }).length > 0
        if (over !== cursorRef.current.hovering) {
          cursorRef.current.hovering = over
          applyCursor()
        }
      })

      loadedRef.current = true

      refreshData(true)
    })

    // Expression/style failures arrive here rather than as exceptions.
    map.on('error', (e) => console.error('[GeoExplorerMap]', e?.error?.message || e))

    map.on('moveend', () => {
      applyCursor()
      refreshData(false)
    })

    return () => {
      popupRef.current?.remove()
      moveMarkerRef.current?.remove()
      moveBarRef.current?.remove()
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
  }, [placingPoint, applyCursor])

  if (!mapboxgl.accessToken) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted)' }}>
        VITE_MAPBOX_TOKEN is not set — the map cannot render.
      </div>
    )
  }

  // Absolutely positioned rather than height:100% — the parent is a flex item,
  // and percentage heights through a flex chain resolve inconsistently, which is
  // what leaves a strip of background under the canvas.
  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}

export default GeoExplorerMap
