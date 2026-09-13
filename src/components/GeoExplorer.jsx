import { useEffect, useState, useCallback, useRef } from 'react'
import { Checkbox, Typography, Button, Spin, Alert, App, Empty, Result, Collapse, Drawer, Input } from 'antd'
import { PlusOutlined, AppstoreOutlined, SearchOutlined, CloseOutlined } from '@ant-design/icons'
import GeoExplorerMap from './GeoExplorerMap'
import GeoPointEditor from './GeoPointEditor'
import {
  CATEGORY_COLORS, FALLBACK_COLOR, OWN_POINT_COLOR, AVAILABILITY_COLORS,
  poiCategoryLabel, poiCategoryGlyph,
  iconSvg, humaniseCategory as humanise,
} from '../utils/geoIcons'
import { geoService } from '../services/geoService'
import { warehouseService } from '../services/warehouseService'
import WarehouseDetailsModal from './WarehouseDetailsModal'
import { useViewport } from '../hooks/useViewport'
import { useAuth } from '../contexts'
import './GeoExplorer.css'

const { Text } = Typography

/**
 * Legend badge — renders the exact glyph the map draws, so the sidebar and the
 * map are read with one visual vocabulary rather than two.
 */
const Badge = ({ color, glyph }) => (
  <span
    style={{ display: 'inline-block', width: 18, height: 18, marginRight: 8, verticalAlign: 'middle' }}
    // Local, non-user-supplied markup built from a fixed glyph table.
    dangerouslySetInnerHTML={{ __html: iconSvg(color, glyph) }}
  />
)

/**
 * GeoExplorer — map page for plotting reference and internal points of interest.
 *
 * Layers start OFF apart from warehouses. Fifteen categories switched on at once
 * is an unreadable map, and the toggles only feel useful if the default state is
 * legible.
 */
const GeoExplorer = () => {
  const { isMobile: phone, width, height } = useViewport()
  const isMobile = phone || (height < 500 && width < 1024)
  const { user } = useAuth()
  // Sessions predating the capabilities map are treated as allowed.
  const hasDashboardAccess = !(user?.capabilities && !user.capabilities.DASHBOARD)
  const { message } = App.useApp()

  const [layers, setLayers] = useState(null)   // null = not loaded yet
  const [enabledOsm, setEnabledOsm] = useState([])
  const [showWarehouses, setShowWarehouses] = useState(true)
  const [showOwnPoints, setShowOwnPoints] = useState(true)
  const [loading, setLoading] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [layersError, setLayersError] = useState(null)

  const [layersOpen, setLayersOpen] = useState(false)
  const [layerSearch, setLayerSearch] = useState('')
  const [placementLocation, setPlacementLocation] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editor, setEditor] = useState(null)
  const [mapBusy, setMapBusy] = useState(false)
  const [mapError, setMapError] = useState(null)
  const [mapNotice, setMapNotice] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  // Full warehouse records, keyed by id. Popups fill in lazily, and reopening a
  // pin should not refetch what we already have.
  const warehouseCache = useRef(new Map())

  useEffect(() => {
    // /api/geo is gated on DASHBOARD, so skip the round trip that would only 403.
    if (!hasDashboardAccess) return
    setLayersError(null)
    geoService.layers()
      .then((d) => setLayers({ osm: d?.osm ?? [], internal: d?.internal ?? [] }))
      .catch((e) => { setLayersError(e?.message || 'Could not load layer list'); setLayers({ osm: [], internal: [] }) })
  }, [refreshKey, hasDashboardAccess])

  const toggleOsm = useCallback((cat, on) => {
    setEnabledOsm((prev) => (on ? [...prev, cat] : prev.filter((c) => c !== cat)))
  }, [])

  // These reject on failure so the popup can surface the error inline, next to
  // the form the user is still looking at, rather than only as a toast.
  const createPoint = useCallback(async (body) => {
    await geoService.createPoint(body)
    setShowOwnPoints(true)
    message.success('Point saved in Our points')
    setRefreshKey((k) => k + 1)
  }, [message])

  const updatePoint = useCallback(async (id, body) => {
    await geoService.updatePoint(id, body)
    message.success('Point updated')
    setRefreshKey((k) => k + 1)
  }, [message])

  const deletePoint = useCallback(async (id) => {
    await geoService.deletePoint(id)
    message.success('Point deleted')
    setRefreshKey((k) => k + 1)
  }, [message])

  /**
   * Whether to offer edit/move/delete on a point.
   *
   * Presentation only — the API independently refuses a mutation from anyone
   * but the author or an admin, so this just avoids showing a control that
   * would fail.
   */
  const canEditPoint = useCallback(
    (createdBy) => !!user && (user.isAdmin || createdBy === user.email),
    [user],
  )

  /**
   * Fetch a full warehouse for the popup's second render pass, caching it so
   * reopening the same pin is instant.
   */
  const fetchWarehouse = useCallback(async (id) => {
    const cached = warehouseCache.current.get(id)
    if (cached) return cached
    const full = await warehouseService.getById(id)
    warehouseCache.current.set(id, full)
    return full
  }, [])

  /**
   * Load and show the full record for a warehouse.
   *
   * The popup carries the at-a-glance summary; this is the deliberate, explicit
   * step into everything else, so reusing the dashboard's details view is both
   * consistent and the only place that whole layout exists.
   */
  const openWarehouse = useCallback(async (id) => {
    setDetailLoading(true)
    try {
      // Usually already cached by the popup that offered the button.
      setDetail(await fetchWarehouse(id))
    } catch (err) {
      message.error(err?.message || 'Could not load that warehouse')
    } finally {
      setDetailLoading(false)
    }
  }, [fetchWarehouse, message])

  const activeCount = Number(showWarehouses) + Number(showOwnPoints) + enabledOsm.length
  const startPlacing = () => { setPlacementLocation(null); setDraft(null); setLayersOpen(false); setPlacing(true) }
  const editPoint = useCallback((at, existing = null) => {
    setPlacing(false)
    setEditor({ at, existing })
  }, [])
  const sidebar = (
    <div className="geo-layers">
      <p className="geo-panel-help">Choose what appears on the map. Counts cover all imported points.</p>
      {layersError && <Alert type="warning" showIcon message="Layers could not load" description={layersError}
        action={<Button onClick={() => mapReady ? setRefreshKey(k => k + 1) : window.location.reload()}>Retry</Button>} />}
      <Collapse ghost defaultActiveKey={['ours']} items={[
        { key: 'ours', label: 'Our data', children: <div className="geo-layer-list">
          <Checkbox checked={showWarehouses} onChange={e => setShowWarehouses(e.target.checked)}>
            <Badge color={AVAILABILITY_COLORS.available} glyph="warehouse" />Warehouses
          </Checkbox>
          <Checkbox checked={showOwnPoints} onChange={e => setShowOwnPoints(e.target.checked)}>
            <Badge color={OWN_POINT_COLOR} glyph="own" />Our points
            <Text type="secondary"> ({layers?.internal?.reduce((sum, c) => sum + c.count, 0) ?? '…'})</Text>
          </Checkbox>
          {showOwnPoints && <div className="geo-own-legend">
            {(layers?.internal ?? []).map(({ category, count }) => <div key={category}>
              <Badge color={OWN_POINT_COLOR} glyph={poiCategoryGlyph(category)} />{poiCategoryLabel(category)} ({count})
            </div>)}
            {layers && !layers.internal.length && <Text type="secondary">Save places with Add a point.</Text>}
          </div>}
        </div> },
        { key: 'reference', label: `Reference places (OSM)${enabledOsm.length ? ` · ${enabledOsm.length} on` : ''}`, children: <>
          <Input aria-label="Search reference layers" placeholder="Find a layer, e.g. Fuel" prefix={<SearchOutlined />} allowClear
            value={layerSearch} onChange={e => setLayerSearch(e.target.value)} />
          {!!enabledOsm.length && <Button type="text" className="geo-clear-layers" onClick={() => setEnabledOsm([])}>Clear reference layers</Button>}
          {!layers && <div role="status" className="geo-panel-help"><Spin size="small" /> Loading layers…</div>}
          {layers && !layersError && !layers.osm.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No reference places imported yet" />}
          <div className="geo-layer-list">
            {(layers?.osm ?? []).filter(({ category }) => humanise(category).toLowerCase().includes(layerSearch.toLowerCase())).map(({ category, count }) => (
              <Checkbox key={category} checked={enabledOsm.includes(category)} onChange={e => toggleOsm(category, e.target.checked)}>
                <Badge color={CATEGORY_COLORS[category] || FALLBACK_COLOR} glyph={category} />{humanise(category)}
                <Text type="secondary"> ({count.toLocaleString('en-IN')})</Text>
              </Checkbox>
            ))}
          </div>
          {layers?.osm.length > 0 && !layers.osm.some(({ category }) => humanise(category).toLowerCase().includes(layerSearch.toLowerCase())) && <p role="status">No matching layers.</p>}
        </> },
      ]} />
      <div className="geo-availability-legend" aria-label="Warehouse availability legend">
        <strong>Warehouse availability</strong>
        <div>{Object.entries(AVAILABILITY_COLORS).map(([label, color]) => <span key={label}><Badge color={color} glyph="warehouse" />{humanise(label)}</span>)}</div>
      </div>
    </div>
  )

  // Same gate as the dashboard: /api/geo requires the DASHBOARD capability, so
  // refuse clearly here rather than letting the map fail request by request.
  if (!hasDashboardAccess) {
    return (
      <Result
        status="403"
        title="No dashboard access"
        subTitle="Your account isn't set up for the dashboard yet. Ask an admin to grant you access."
      />
    )
  }

  return (
    <div className="geo-explorer">
      {!isMobile && <aside className="geo-sidebar" aria-label="Map layers">
        <div className="geo-panel-heading"><h1>Map explorer</h1><span>{activeCount} layers on</span></div>
        {sidebar}
        <Button type="primary" icon={<PlusOutlined aria-hidden="true" />} block disabled={!mapReady || placing || mapBusy || !!editor} onClick={startPlacing}>Add a point</Button>
        <p className="geo-panel-help">Position a pin, then add a name and type.</p>
      </aside>}
      <div className={`geo-map-pane${mapNotice || mapError ? ' geo-map-has-notice' : ''}`}>
        <GeoExplorerMap
          enabledOsmCategories={enabledOsm} showWarehouses={showWarehouses} showOwnPoints={showOwnPoints}
          placingPoint={placing} placementLocation={placementLocation} canEditPoint={canEditPoint}
          onEditPoint={editPoint} onUpdatePoint={updatePoint} onDeletePoint={deletePoint}
          onOpenWarehouse={openWarehouse} onFetchWarehouse={fetchWarehouse}
          onPlacingChange={setPlacing} onLoadingChange={setLoading} onTruncated={setTruncated}
          onErrorChange={setMapError} onReadyChange={setMapReady} onBusyChange={setMapBusy}
          onNoticeChange={setMapNotice}
          overlayOpen={layersOpen || !!editor} refreshKey={refreshKey}
        />
        {!isMobile && !placing && !mapBusy && <div className="geo-map-heading">
          <strong>Map explorer</strong><span>{activeCount ? `${activeCount} layers on · Tap a pin for details` : 'All layers hidden · Open Layers to show places'}</span>
        </div>}
        <div className="geo-map-status" aria-live="polite">
          {(loading || detailLoading) && <div className="geo-status-chip"><Spin size="small" />{detailLoading ? 'Opening warehouse…' : 'Loading places…'}</div>}
          {mapError && <Alert type="warning" showIcon message={mapError} action={<Button onClick={() => mapReady ? setRefreshKey(k => k + 1) : window.location.reload()}>Retry</Button>} />}
          {mapNotice && <Alert className={isMobile ? 'geo-map-notice-compact' : undefined} type={mapNotice.type} showIcon={!isMobile} message={<>
            <span className="geo-notice-message">{isMobile ? mapNotice.compactMessage || mapNotice.message : mapNotice.message}</span>
            {mapNotice.actions?.length > 0 && <div className="geo-notice-actions">
              {mapNotice.actions.map(action => <Button key={action.label} onClick={action.onClick}>{action.label}</Button>)}
            </div>}
          </>} closable onClose={() => setMapNotice(null)} />}
          {truncated && <div className="geo-status-chip">Some places are hidden. Zoom in to see more.</div>}
        </div>
        {isMobile && !placing && !mapBusy && !editor && <div className="geo-mobile-actions">
          <Button icon={<AppstoreOutlined aria-hidden="true" />} aria-expanded={layersOpen} aria-controls="geo-layer-panel" onClick={() => setLayersOpen(true)}>Layers <span className="geo-count">{activeCount}</span></Button>
          <Button type="primary" icon={<PlusOutlined aria-hidden="true" />} disabled={!mapReady} onClick={startPlacing}>Add a point</Button>
        </div>}
      </div>
      <Drawer title="Map layers" placement="bottom" height="min(72dvh, 620px)" open={isMobile && layersOpen}
        onClose={() => setLayersOpen(false)} rootClassName="geo-layer-drawer" closeIcon={<CloseOutlined />}
        footer={<Button type="primary" block onClick={() => setLayersOpen(false)}>Show map · {activeCount} layers on</Button>}>
        <div id="geo-layer-panel">{sidebar}</div>
      </Drawer>
      {editor && <GeoPointEditor at={editor.at} existing={editor.existing} draft={draft} isMobile={isMobile}
        onCancel={() => setEditor(null)} onChangeLocation={values => { setPlacementLocation(editor.at); setDraft(values); setEditor(null); setPlacing(true) }}
        onSave={async body => {
          if (editor.existing) await updatePoint(editor.existing.id, body)
          else await createPoint({ ...body, ...editor.at })
          setEditor(null)
        }} />}
      <WarehouseDetailsModal visible={!!detail} warehouse={detail} onClose={() => setDetail(null)} />
    </div>
  )
}

export default GeoExplorer
