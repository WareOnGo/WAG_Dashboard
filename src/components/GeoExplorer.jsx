import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, Checkbox, Typography, Button, Spin, Alert, App, Empty, Result } from 'antd'
import { PlusOutlined, AimOutlined } from '@ant-design/icons'
import GeoExplorerMap from './GeoExplorerMap'
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

const { Title, Text } = Typography

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
  const { isMobile } = useViewport()
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
    message.success('Point saved')
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

  const sidebar = (
    <Card size="small" variant="borderless" style={{ background: 'transparent' }} styles={{ body: { padding: 0 } }}>
      <Title level={5} style={{ marginTop: 0 }}>Our data</Title>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Checkbox checked={showWarehouses} onChange={(e) => setShowWarehouses(e.target.checked)}>
          <Badge color={AVAILABILITY_COLORS.available} glyph="warehouse" />Warehouses
        </Checkbox>
        <Checkbox checked={showOwnPoints} onChange={(e) => setShowOwnPoints(e.target.checked)}>
          <Badge color={OWN_POINT_COLOR} glyph="own" />Our points
          {layers?.internal?.length > 0 && (
            <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
              ({layers.internal.reduce((s, c) => s + c.count, 0)})
            </Text>
          )}
        </Checkbox>

        {/* Our points all share one purple badge and one toggle, but each type
            draws a different glyph on the map. Listing them here is what makes
            those glyphs readable — without it the legend claims a star and the
            map shows six other shapes. */}
        {showOwnPoints && (layers?.internal ?? []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 24 }}>
            {layers.internal.map(({ category, count }) => (
              <div key={category} style={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                <Badge color={OWN_POINT_COLOR} glyph={poiCategoryGlyph(category)} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {poiCategoryLabel(category)} ({count})
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>

      <Title level={5} style={{ marginTop: 18 }}>Reference (OSM)</Title>
      {layersError && <Alert type="warning" showIcon message={layersError} style={{ marginBottom: 8 }} />}

      {/* Skeleton rows sized like real toggles, so the panel does not reflow
          when the categories arrive. */}
      {!layers && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="geo-skel" style={{ width: 16, height: 16, borderRadius: '50%' }} />
              <span className="geo-skel" style={{ height: 12, width: `${70 - i * 10}%` }} />
            </div>
          ))}
        </div>
      )}

      {layers && !layersError && layers.osm.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: 12 }}>No OSM points imported yet</Text>}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {(layers?.osm ?? []).map(({ category, count }) => (
          <Checkbox
            key={category}
            checked={enabledOsm.includes(category)}
            onChange={(e) => toggleOsm(category, e.target.checked)}
          >
            <Badge color={CATEGORY_COLORS[category] || FALLBACK_COLOR} glyph={category} />
            {humanise(category)}
            <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>({count})</Text>
          </Checkbox>
        ))}
      </div>

      <Button
        type={placing ? 'primary' : 'default'}
        icon={placing ? <AimOutlined /> : <PlusOutlined />}
        onClick={() => setPlacing((p) => !p)}
        block
        style={{ marginTop: 18 }}
      >
        {placing ? 'Click the map to place…' : 'Add a point'}
      </Button>

      {truncated && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12, fontSize: 12 }}
          message="Showing a partial view"
          description="Too many points in this area — zoom in to see them all."
        />
      )}
    </Card>
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
    // position:absolute + inset:0 rather than height:100%: this sits inside
    // ProtectedRoute's wrapper div, which has no height of its own, so a
    // percentage height would collapse to zero.
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      {/* Sidebar owns its own padding; the map gets none so it runs to the edge. */}
      <div style={{
        width: isMobile ? '100%' : 280,
        flex: isMobile ? '0 0 auto' : '0 0 280px',
        padding: 16,
        overflowY: 'auto',
        borderRight: isMobile ? 'none' : '1px solid var(--border-primary)',
        borderBottom: isMobile ? '1px solid var(--border-primary)' : 'none',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Title level={4} style={{ margin: 0 }}>Map</Title>
          {(loading || detailLoading) && <Spin size="small" />}
        </div>
        {/* Sits directly under the title so viewport fetches are visible without
            moving anything: the bar occupies its 2px whether or not it is lit. */}
        <div style={{ height: 2, marginBottom: 12, borderRadius: 2, overflow: 'hidden', background: 'transparent' }}>
          {(loading || detailLoading) && (
            <div className="geo-skel" style={{ height: '100%', width: '100%' }} />
          )}
        </div>
        {sidebar}
      </div>

      {/* Fills all remaining space. minHeight:0 stops the flex item from
          refusing to shrink, which is what leaves a gap below the canvas. */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative' }}>
        <GeoExplorerMap
          enabledOsmCategories={enabledOsm}
          showWarehouses={showWarehouses}
          showOwnPoints={showOwnPoints}
          placingPoint={placing}
          canEditPoint={canEditPoint}
          onCreatePoint={createPoint}
          onUpdatePoint={updatePoint}
          onDeletePoint={deletePoint}
          onOpenWarehouse={openWarehouse}
          onFetchWarehouse={fetchWarehouse}
          onPlacingChange={setPlacing}
          onLoadingChange={setLoading}
          onTruncated={setTruncated}
          refreshKey={refreshKey}
        />
      </div>

      <WarehouseDetailsModal
        visible={!!detail}
        warehouse={detail}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}

export default GeoExplorer
