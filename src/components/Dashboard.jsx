import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import {
  Button,
  Typography,
  Card,
  Tooltip,
  App,
  Input,
  Result
} from 'antd';

import {
  PlusOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import CardView from './CardView';
import ListingPagination from './ListingPagination';

// Lazy-loaded heavy components:
//  - MapView pulls in mapbox-gl (~1MB), only needed when the map/split view is open.
//  - WarehouseForm is ~1k lines, only needed when creating/editing a warehouse.
const MapView = React.lazy(() => import('./MapView'));
const WarehouseForm = React.lazy(() => import('./WarehouseForm'));
import WarehouseDetailsModal from './WarehouseDetailsModal';
import WarehouseFilterBar, { AppliedWarehouseFilters } from './WarehouseFilterBar';
import './ResponsiveModal.css';
import { useViewport } from '../hooks';
import useWarehouseFilters from '../hooks/useWarehouseFilters';
import { useAuth } from '../contexts';
import {
  showSuccessMessage,
  withRetry,
  clearErrors
} from '../utils/errorHandler';
import { imageLabelService } from '../services/imageLabelService';
import { EDIT_PREFILL_REASON } from '../utils/revealReason';

const { Text } = Typography;

/**
 * Shallow value equality for the flat filter-param objects `useWarehouseFilters`
 * builds. Values are scalars, so identity comparison per key is enough.
 */
const sameParams = (a, b) => {
  const aKeys = Object.keys(a);
  return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
};

const Dashboard = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Authentication context
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  // The warehouse routes are gated on the DASHBOARD capability server-side. Fetching
  // anyway would just spend a round trip to be told 403, so the effects below check
  // this too — the render-time refusal alone runs after the hooks have already fired.
  // Sessions predating the capabilities map are treated as allowed.
  const hasDashboardAccess = !(user?.capabilities && !user.capabilities.DASHBOARD);

  // Cards are the dashboard's listing view at every viewport width.
  const { isMobile } = useViewport();

  // Filter and search state + logic (shared with the review queue)
  const filters = useWarehouseFilters(warehouses);
  const {
    queryParams,
    searchText, setSearchText,
  } = filters;

  // View details modal state
  const [viewDetailsVisible, setViewDetailsVisible] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  // Filter panel visibility
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Pagination state (server-side). `total` is the filtered total from the API;
  // `warehouses` holds only the current page.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Debounced copy of the filter query params so typing in search doesn't fire a
  // request per keystroke. Drives the server-side fetch. Seeded from the live
  // params so the first debounce settle has nothing to commit.
  const [debouncedParams, setDebouncedParams] = useState(queryParams);

  // Map markers for split view: all warehouses matching the current filters
  // (fetched separately from the paged list so the map stays complete).
  const [mapCoords, setMapCoords] = useState([]);

  // Guards against out-of-order list responses (last request wins).
  const reqIdRef = useRef(0);
  const resultsRef = useRef(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  // Mutations can finish after the user changes filters or pages. Refresh via
  // the effects so both list and map use the current query and access state.
  const refreshWarehouses = useCallback(() => setRefreshVersion(version => version + 1), []);

  // Split view state
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);

  // Get modal instance from App context
  const { modal, message } = App.useApp();

  // Fetch a page of warehouses with the current filters/page applied server-side.
  const fetchWarehouses = useCallback(async () => {
    if (authLoading || !isAuthenticated || !hasDashboardAccess) return;

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await warehouseService.list({
        ...debouncedParams,
        page: currentPage,
        limit: pageSize,
        // Rows come back with `imageLabels` attached, so opening a details modal
        // paints its segmented gallery on the first render — no second request,
        // and no flat-then-segmented reflow.
        includeImageLabels: 'true',
      });
      // Ignore stale responses (a newer request has since been issued).
      if (reqId !== reqIdRef.current) return;
      const nextTotal = res?.pagination?.total ?? 0;
      // A deletion can remove the final row of the final page. Ask for the last
      // remaining page instead of leaving the user stranded on an empty page.
      const lastPage = Math.max(1, Math.ceil(nextTotal / pageSize));
      if (currentPage > lastPage) {
        setCurrentPage(lastPage);
        return;
      }
      setWarehouses(Array.isArray(res?.data) ? res.data : []);
      setTotal(nextTotal);
    } catch (err) {
      if (reqId === reqIdRef.current) setError(err.message);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [authLoading, isAuthenticated, hasDashboardAccess, debouncedParams, currentPage, pageSize]);

  // Network/connection failures (no HTTP response) get a connection-specific
  // message + icon; everything else is a generic error.
  const isNetworkError = !!error && /network|connection/i.test(error);

  // Fetch when authenticated and whenever the page/size/filters change.
  useEffect(() => {
    if (!authLoading && isAuthenticated && hasDashboardAccess) {
      fetchWarehouses();
    } else {
      setWarehouses([]);
      setTotal(0);
      setLoading(false);
    }
    // Access changes and unmounts also invalidate pending requests, even when
    // there is no replacement request to advance the sequence number.
    return () => { reqIdRef.current += 1; };
  }, [authLoading, isAuthenticated, hasDashboardAccess, fetchWarehouses, refreshVersion]);

  // Debounce filter changes into `debouncedParams` and reset to page 1. `queryParams`
  // is a stable memo (only changes when a filter changes), so this fires once per change.
  useEffect(() => {
    if (sameParams(debouncedParams, queryParams)) return;
    const t = setTimeout(() => {
      // Reset pagination only when the effective filters actually change.
      setDebouncedParams(queryParams);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [queryParams, debouncedParams]);

  // Keep the split-view map complete: fetch coordinates for ALL filtered rows
  // (not just the current page) when filters change or a mutation completes.
  useEffect(() => {
    if (authLoading || !isAuthenticated || !hasDashboardAccess) {
      setMapCoords([]);
      return;
    }
    if (!splitViewEnabled) return;
    let active = true;
    warehouseService.getCoordinates(debouncedParams)
      .then((rows) => { if (active) setMapCoords(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setMapCoords([]); });
    return () => { active = false; };
  }, [authLoading, isAuthenticated, hasDashboardAccess, debouncedParams, splitViewEnabled, refreshVersion]);

  // MapView reads coordinates from top-level latitude/longitude; adapt the
  // lightweight { id, lat, lng } payload from the coordinates endpoint.
  const mapMarkers = useMemo(
    () => mapCoords.map((c) => ({
      id: c.id, latitude: c.lat, longitude: c.lng, availability: c.availability,
    })),
    [mapCoords],
  );

  // Shared pager for the cards, with or without the split map.
  // Server-driven: changing page/size triggers a refetch via the fetch effect.
  // Keep desktop page-size controls available after choosing a size that fits
  // all results, so the user can return to the default size.
  const cardPager = total > pageSize || (!isMobile && pageSize !== 20 && total > 0) ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '12px 0' : '16px 0' }}>
      <ListingPagination
        current={currentPage}
        pageSize={pageSize}
        total={total}
        pageSizeOptions={['10', '20', '50', '100']}
        disabled={loading}
        onChange={(page, size) => {
          setCurrentPage(page);
          if (size !== pageSize) setPageSize(size);
          if (isMobile) resultsRef.current?.scrollIntoView({ block: 'start' });
        }}
      />
    </div>
  ) : null;

  const handleDelete = useCallback((warehouse) => {
    modal.confirm({
      title: 'Delete Warehouse',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to delete this warehouse?</p>
          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '6px' }}>
            <p><strong>ID:</strong> {warehouse.id}</p>
            <p><strong>Type:</strong> {warehouse.warehouseType}</p>
            <p><strong>Address:</strong> {warehouse.address}, {warehouse.city}</p>
          </div>
          <p style={{ color: '#ff4d4f', marginTop: '12px' }}>This action cannot be undone.</p>
        </div>
      ),
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      width: 500,
      onOk: async () => {
        try {
          await withRetry(
            () => warehouseService.delete(warehouse.id),
            {
              operationType: 'delete',
              maxRetries: 1 // Don't retry delete operations multiple times
            }
          );
          imageLabelService.invalidate(warehouse.id);

          // Update local state after successful deletion
          setWarehouses(prev => prev.filter(w => w.id !== warehouse.id));
          showSuccessMessage('delete');
          refreshWarehouses();
        } catch {
          // Error already handled by withRetry
        }
      },
    });
  }, [modal, refreshWarehouses]);

  const handleEdit = useCallback((warehouse) => {
    setEditingWarehouse(warehouse);
    setFormVisible(true);

    // Fetch the real contact number in the background so saving the form doesn't wipe
    // it. This isn't a deal lookup and there's no one to prompt, so the audit entry
    // records it as an edit rather than implying a deal.
    warehouseService.getContactNumber(warehouse.id, EDIT_PREFILL_REASON)
      .then(contactInfo => {
        setEditingWarehouse(prev =>
          prev && prev.id === warehouse.id
            ? { ...prev, contactNumber: contactInfo.contactNumber }
            : prev
        );
      })
      .catch(() => {});
  }, []);

  const handleCreate = () => {
    setEditingWarehouse(null);
    setFormVisible(true);
  };

  const handleFormCancel = () => {
    setFormVisible(false);
    setEditingWarehouse(null);
    clearErrors(); // Clear any existing error messages
  };

  const handleFormSubmit = async (formData) => {
    const operationType = editingWarehouse ? 'update' : 'create';
    const actionText = editingWarehouse ? 'update' : 'create';

    // Show confirmation before saving
    return new Promise((resolve, reject) => {
      modal.confirm({
        title: `Confirm ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
        icon: <ExclamationCircleOutlined />,
        content: (
          <div>
            <p>Are you sure you want to {actionText} this warehouse?</p>
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '6px' }}>
              <p><strong>Type:</strong> {formData.warehouseType}</p>
              <p><strong>Address:</strong> {formData.address}, {formData.city}</p>
              <p><strong>Zone:</strong> {formData.zone}</p>
              <p><strong>Contact:</strong> {formData.contactPerson} ({formData.contactNumber})</p>
            </div>
          </div>
        ),
        okText: `Yes, ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
        cancelText: 'Cancel',
        width: 500,
        onOk: async () => {
          setFormLoading(true);

          try {
            // Photos are already uploaded by WarehouseForm before reaching here —
            // formData.photos already contains the final URL string.

            let result;

            if (editingWarehouse) {
              // Update existing warehouse
              result = await withRetry(
                () => warehouseService.update(editingWarehouse.id, formData),
                {
                  operationType,
                  maxRetries: 1
                }
              );

              // An edit can add or remove images, so the cached labels for this
              // warehouse are no longer trustworthy. Drop them and let the next
              // open re-fetch; newly added images stay unlabelled until the
              // sweep runs, which the fallback handles.
              imageLabelService.invalidate(editingWarehouse.id);

              const updatedWarehouse = {
                ...editingWarehouse,
                ...result,
                visibility: result.visibility !== undefined ? Boolean(result.visibility) : Boolean(formData.visibility)
              };

              setWarehouses(prev =>
                prev.map(w => w.id === editingWarehouse.id ? updatedWarehouse : w)
              );
            } else {
              // Create new warehouse -> goes through the staging layer. With autopilot on
              // it is promoted to master immediately and comes back with a numeric
              // `warehouseId`; with autopilot off it waits in the PENDING review queue and
              // `warehouseId` is null. Either way the response is a submission receipt
              // (see backend utils/submissionResult.js), not a full warehouse row.
              result = await withRetry(
                () => warehouseService.create(formData),
                {
                  operationType,
                  maxRetries: 1
                }
              );
            }

            // Close form and reset state
            setFormVisible(false);
            setEditingWarehouse(null);

            // Show success message
            if (operationType === 'update') {
              showSuccessMessage('update', {
                details: `${result.warehouseType || formData.warehouseType} in ${result.city || formData.city}`
              });
              refreshWarehouses();
            } else if (result.warehouseId != null) {
              // Autopilot promoted it straight to master, so there is a real warehouse to
              // name. Surface that ID, not the staging uuid, and pull the new row into the
              // list — the create path otherwise never refreshes it, which would leave a
              // live warehouse missing from the list until a manual reload.
              modal.success({
                title: 'Warehouse created',
                content: (
                  <div>
                    <p style={{ marginBottom: 12 }}>
                      {formData.warehouseType} in {formData.city} is live.
                    </p>
                    <p style={{ marginBottom: 4, color: 'rgba(255, 255, 255, 0.65)' }}>
                      Warehouse ID:
                    </p>
                    <Text copyable={{ text: String(result.warehouseId) }} strong style={{ fontSize: 15 }}>
                      {result.warehouseId}
                    </Text>
                  </div>
                ),
                okText: 'Done',
              });
              refreshWarehouses();
            } else {
              // Left in the review queue. Surface the staged entry's reference ID (uuid) so
              // the employee can keep it to track the submission through review later.
              modal.success({
                title: 'Submitted for review',
                content: (
                  <div>
                    <p style={{ marginBottom: 12 }}>
                      {formData.warehouseType} in {formData.city} is pending admin approval.
                    </p>
                    <p style={{ marginBottom: 4, color: 'rgba(255, 255, 255, 0.65)' }}>
                      Reference ID — save this to track it later:
                    </p>
                    <Text
                      copyable={{ text: result.submissionId ?? result.id }}
                      strong
                      style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}
                    >
                      {result.submissionId ?? result.id}
                    </Text>
                  </div>
                ),
                okText: 'Done',
              });
            }
            resolve(result);

          } catch (error) {
            setFormLoading(false);
            reject(error);
          } finally {
            setFormLoading(false);
          }
        },
        onCancel: () => {
          reject(new Error('User cancelled'));
        }
      });
    });
  };

  // Handle view details
  const handleViewDetails = useCallback((warehouse) => {
    setSelectedWarehouse(warehouse);
    setViewDetailsVisible(true);
  }, []);

  // Handle toggle visibility
  const handleToggleVisibility = useCallback(async (warehouse, newVisibility) => {
    try {
      const visibilityBoolean = newVisibility === 'visible';

      // Optimistically update the UI
      setWarehouses(prev =>
        prev.map(w => w.id === warehouse.id ? { ...w, visibility: visibilityBoolean } : w)
      );

      // Update on the server
      await withRetry(
        () => warehouseService.update(warehouse.id, {
          ...warehouse,
          visibility: visibilityBoolean
        }),
        {
          operationType: 'update',
          maxRetries: 1
        }
      );

      // Show success message
      message.success(`Warehouse ${newVisibility === 'visible' ? 'shown' : 'hidden'} successfully`);
      refreshWarehouses();

    } catch {
      // Revert the optimistic update on error
      setWarehouses(prev =>
        prev.map(w => w.id === warehouse.id ? warehouse : w)
      );
      // Error already handled by withRetry
    }
  }, [message, refreshWarehouses]);

  // The warehouse routes are gated on the DASHBOARD capability server-side, so an
  // account that isn't on the employee roster would otherwise sign in successfully
  // and then meet a bare error toast over an empty page. Sessions predating the
  // capabilities map are treated as allowed, so a stale token locks nobody out.
  if (!hasDashboardAccess) {
    return (
      <Result
        status="403"
        title="No dashboard access"
        subTitle="Your account isn't set up for the dashboard yet. Ask an admin to grant you access."
      />
    );
  }

  return (
    <div className="dashboard-page" style={{ padding: isMobile ? '8px' : '24px' }}>
      <Card
        className="dashboard-panel"
        style={{
          background: 'var(--bg-secondary)',
          backdropFilter: isMobile ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: isMobile ? 'none' : 'blur(20px)',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
        }}
        bodyStyle={isMobile ? { padding: '12px' } : undefined}
      >
        {/* Search Bar and Actions */}
        <div className="dashboard-toolbar" style={{
          display: 'flex',
          gap: isMobile ? '10px' : '12px',
          marginBottom: isMobile ? '10px' : '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <div className="dashboard-search-row" style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flex: 1,
            minWidth: isMobile ? '100%' : 'auto'
          }}>
            <Input
              aria-label="Search warehouses"
              placeholder="Search warehouses..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: isMobile ? '100%' : '400px' }}
            />
            {/* Filters button stays in the search row on desktop; on mobile it moves
                into the actions row below to keep this row to just the search field. */}
            {!isMobile && (
              <Button
                icon={<FilterOutlined />}
                aria-expanded={filtersVisible}
                onClick={() => setFiltersVisible(!filtersVisible)}
                type={filtersVisible ? 'primary' : 'default'}
                size="middle"
              >
                Filters
              </Button>
            )}
            {!isMobile && (
              <div style={{
                color: 'rgba(255, 255, 255, 0.65)',
                fontSize: '14px',
                whiteSpace: 'nowrap'
              }}>
                {warehouses.length} of {total} results
              </div>
            )}
          </div>

          <div className="dashboard-actions-row" style={{
            display: 'flex',
            gap: isMobile ? '8px' : '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-end'
          }}>
            {/* Left control group: filter (mobile) + map toggle */}
            <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'center' }}>
              {isMobile && (
                <Button
                  icon={<FilterOutlined />}
                  aria-expanded={filtersVisible}
                  onClick={() => setFiltersVisible(!filtersVisible)}
                  type={filtersVisible ? 'primary' : 'default'}
                  size="small"
                  aria-label="Filters"
                />
              )}

              <Tooltip title={splitViewEnabled ? "Close map" : "Show map"}>
                <Button
                  icon={<EnvironmentOutlined />}
                  onClick={() => setSplitViewEnabled(!splitViewEnabled)}
                  type={splitViewEnabled ? 'primary' : 'default'}
                  size={isMobile ? 'small' : 'large'}
                >
                  {isMobile ? '' : splitViewEnabled ? 'Hide Map' : 'Show Map'}
                </Button>
              </Tooltip>
            </div>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
              size={isMobile ? 'small' : 'large'}
            >
              {isMobile ? 'Add' : 'Add Warehouse'}
            </Button>
          </div>
        </div>

        {/* Mobile-only: subtle results count on its own line */}
        {isMobile && (
          <div style={{
            color: 'rgba(255, 255, 255, 0.55)',
            fontSize: '12px',
            marginBottom: '12px'
          }}>
            {warehouses.length} of {total} results
          </div>
        )}

        <AppliedWarehouseFilters filters={filters} resultCount={total} loading={loading} />
        {filtersVisible && <WarehouseFilterBar filters={filters} />}

        {/* Thin banner only when we already have rows to show (a refresh failed):
            the empty-load failure is surfaced inside the content box below instead. */}
        {error && warehouses.length > 0 && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: '#ff4d4f20',
            border: '1px solid #ff4d4f',
            borderRadius: '6px',
            color: '#ff4d4f'
          }}>
            Error: {error}
          </div>
        )}

        <div style={{
          background: 'var(--bg-secondary)',
          backdropFilter: isMobile ? 'none' : 'blur(15px)',
          WebkitBackdropFilter: isMobile ? 'none' : 'blur(15px)',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isMobile ? '0' : '8px',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}>
          {/* Load failed with nothing to show (e.g. poor network): centered retry
              in the space the cards normally occupy. Toolbar stays put. */}
          {error && warehouses.length === 0 && !loading ? (
            <Result
              icon={
                isNetworkError
                  ? <WifiOutlined style={{ color: '#ff4d4f' }} />
                  : <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
              }
              title={isNetworkError ? 'Connection problem' : 'Something went wrong'}
              subTitle={error}
              extra={
                <Button
                  type="primary"
                  size="large"
                  icon={<ReloadOutlined />}
                  loading={loading}
                  onClick={fetchWarehouses}
                >
                  Retry
                </Button>
              }
              style={{ padding: isMobile ? '48px 16px' : '64px 16px' }}
            />
          ) : splitViewEnabled ? (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '16px',
              padding: '16px',
              height: isMobile ? 'auto' : 'calc(100vh - 300px)'
            }}>
              {/* Cards View */}
              <div ref={resultsRef} style={{
                scrollMarginTop: isMobile ? 80 : undefined,
                flex: isMobile ? 'none' : 1,
                // On mobile the listings sit BELOW the map (order 2) and flow in the
                // normal page scroll (no inner scroll-box), so you scroll past the map
                // straight into the cards.
                order: isMobile ? 2 : 0,
                overflow: isMobile ? 'visible' : 'auto',
                height: 'auto'
              }}>
                <CardView
                  warehouses={warehouses}
                  loading={loading}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onViewDetails={handleViewDetails}
                  onToggleVisibility={handleToggleVisibility}
                  columnsPerRow={2}
                  paginated={false}
                />
                {cardPager}
              </div>

              {/* Map View */}
              <div style={{
                // Definite 400px height on mobile so MapView's percentage-height canvas
                // resolves; shown ABOVE the listings (order 1) and scrolls away with the
                // page rather than staying pinned.
                flex: isMobile ? 'none' : 1,
                order: isMobile ? 1 : 0,
                height: isMobile ? '400px' : 'auto',
                minHeight: isMobile ? '400px' : 'auto',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <Suspense fallback={
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'rgba(255,255,255,0.65)' }}>
                    Loading map…
                  </div>
                }>
                  <MapView
                    warehouses={mapMarkers}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onViewDetails={handleViewDetails}
                  />
                </Suspense>
              </div>
            </div>
          ) : (
            <div ref={resultsRef} className="dashboard-card-results" style={{ padding: isMobile ? '4px' : '16px', scrollMarginTop: isMobile ? 80 : undefined }}>
              <CardView
                warehouses={warehouses}
                loading={loading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewDetails={handleViewDetails}
                onToggleVisibility={handleToggleVisibility}
                paginated={false}
              />
              {cardPager}
            </div>
          )}
        </div>
      </Card>

      {/* Warehouse Form Modal — lazy: only mount (and fetch its chunk) when opened */}
      {formVisible && (
        <Suspense fallback={null}>
          <WarehouseForm
            visible={formVisible}
            onCancel={handleFormCancel}
            onSubmit={handleFormSubmit}
            initialData={editingWarehouse}
            loading={formLoading}
          />
        </Suspense>
      )}

      {/* View Details Modal */}
      <WarehouseDetailsModal
        visible={viewDetailsVisible}
        onClose={() => setViewDetailsVisible(false)}
        warehouse={selectedWarehouse}
      />
    </div>
  );
};

export default Dashboard;
