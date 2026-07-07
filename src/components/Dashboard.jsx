import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import {
  Table,
  Button,
  Typography,
  Card,
  Tooltip,
  App,
  Input,
  Select,
  Row,
  Col,
  Image,
  Slider,
  Tag,
  Pagination
} from 'antd';

const { Option } = Select;

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  CloseOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import {
  ContextMenu,
  ResponsiveTable,
  CardView,
  ViewSwitcher,
  MobileFilterDrawer
} from './index';

// Lazy-loaded heavy components:
//  - MapView pulls in mapbox-gl (~1MB), only needed when the map/split view is open.
//  - WarehouseForm is ~1k lines, only needed when creating/editing a warehouse.
const MapView = React.lazy(() => import('./MapView'));
const WarehouseForm = React.lazy(() => import('./WarehouseForm'));
import ResponsiveModal from './ResponsiveModal';
import WarehouseDetailsModal from './WarehouseDetailsModal';
import WarehouseFilterBar from './WarehouseFilterBar';
import RedactedPhone from './RedactedPhone';
import './ResponsiveModal.css';
import { useViewport, useViewPreference } from '../hooks';
import useWarehouseFilters from '../hooks/useWarehouseFilters';
import { useAuth } from '../contexts';
import {
  showSuccessMessage,
  withRetry,
  clearErrors
} from '../utils/errorHandler';
import { getMediaFromWarehouse } from '../utils/mediaUtils';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Authentication context
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Responsive and view management
  const { isMobile } = useViewport();
  const {
    currentView,
    changeView,
    isTransitioning
  } = useViewPreference();

  // Filter and search state + logic (shared with the review queue)
  const filters = useWarehouseFilters(warehouses);
  const {
    queryParams,
    searchText, setSearchText,
    selectedOwnerType,
    selectedType,
    selectedCity,
    selectedState,
    selectedZone,
    selectedAvailability,
    selectedBroker,
    fireNocFilter,
    selectedLandType,
    selectedUploadedBy,
    selectedVisibility,
    areaRange,
    budgetRange,
  } = filters;

  // View details modal state
  const [viewDetailsVisible, setViewDetailsVisible] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);

  // Filter panel visibility
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    record: null
  });

  // Pagination state (server-side). `total` is the filtered total from the API;
  // `warehouses` holds only the current page.
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Debounced copy of the filter query params so typing in search doesn't fire a
  // request per keystroke. Drives the server-side fetch.
  const [debouncedParams, setDebouncedParams] = useState({});

  // Map markers for split view: all warehouses matching the current filters
  // (fetched separately from the paged list so the map stays complete).
  const [mapCoords, setMapCoords] = useState([]);

  // Guards against out-of-order list responses (last request wins).
  const reqIdRef = useRef(0);

  // Split view state
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);

  // Get modal instance from App context
  const { modal, message } = App.useApp();

  // Fetch a page of warehouses with the current filters/page applied server-side.
  const fetchWarehouses = useCallback(async () => {
    if (!isAuthenticated) return;

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await warehouseService.list({
        ...debouncedParams,
        page: currentPage,
        limit: pageSize,
      });
      // Ignore stale responses (a newer request has since been issued).
      if (reqId !== reqIdRef.current) return;
      setWarehouses(Array.isArray(res?.data) ? res.data : []);
      setTotal(res?.pagination?.total ?? 0);
    } catch (err) {
      if (reqId === reqIdRef.current) setError(err.message);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [isAuthenticated, debouncedParams, currentPage, pageSize]);

  // Fetch when authenticated and whenever the page/size/filters change.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchWarehouses();
    }
  }, [authLoading, isAuthenticated, fetchWarehouses]);

  // Debounce filter changes into `debouncedParams` and reset to page 1. `queryParams`
  // is a stable memo (only changes when a filter changes), so this fires once per change.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedParams(queryParams);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [queryParams]);

  // Keep the split-view map complete: fetch coordinates for ALL filtered rows
  // (not just the current page) whenever the map is visible and filters change.
  useEffect(() => {
    if (!isAuthenticated) return;
    const mapVisible = splitViewEnabled && currentView === 'cards';
    if (!mapVisible) return;
    let active = true;
    warehouseService.getCoordinates(debouncedParams)
      .then((rows) => { if (active) setMapCoords(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (active) setMapCoords([]); });
    return () => { active = false; };
  }, [isAuthenticated, debouncedParams, splitViewEnabled, currentView]);

  // MapView reads coordinates from top-level latitude/longitude; adapt the
  // lightweight { id, lat, lng } payload from the coordinates endpoint.
  const mapMarkers = useMemo(
    () => mapCoords.map((c) => ({
      id: c.id, latitude: c.lat, longitude: c.lng, availability: c.availability,
    })),
    [mapCoords],
  );

  // Shared pager for the card/grid views (the table has its own built-in pager).
  // Server-driven: changing page/size triggers a refetch via the fetch effect.
  const cardPager = total > pageSize ? (
    <div style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '12px 0' : '16px 0' }}>
      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={total}
        showSizeChanger={!isMobile}
        pageSizeOptions={['10', '20', '50', '100']}
        showTotal={(t, range) => `${range[0]}-${range[1]} of ${t}`}
        onChange={(page, size) => {
          setCurrentPage(page);
          if (size !== pageSize) setPageSize(size);
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
          <div style={{ marginTop: '12px', padding: '12px', background: '#262626', borderRadius: '6px' }}>
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

          // Update local state after successful deletion
          setWarehouses(prev => prev.filter(w => w.id !== warehouse.id));
          showSuccessMessage('delete');
        } catch {
          // Error already handled by withRetry
        }
      },
    });
  }, [modal]);

  const handleEdit = useCallback((warehouse) => {
    setEditingWarehouse(warehouse);
    setFormVisible(true);

    // Fetch the real contact number in the background
    warehouseService.getContactNumber(warehouse.id)
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
            <div style={{ marginTop: '12px', padding: '12px', background: '#262626', borderRadius: '6px' }}>
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

              const updatedWarehouse = {
                ...editingWarehouse,
                ...result,
                visibility: result.visibility !== undefined ? Boolean(result.visibility) : Boolean(formData.visibility)
              };

              setWarehouses(prev =>
                prev.map(w => w.id === editingWarehouse.id ? updatedWarehouse : w)
              );
            } else {
              // Create new warehouse -> now staged for admin review (PENDING).
              // It does NOT enter the master list until an admin approves it.
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
            } else {
              // Surface the staged entry's reference ID (uuid) so the employee can keep it
              // to track the submission through review later.
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
                      copyable={{ text: result.id }}
                      strong
                      style={{ fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}
                    >
                      {result.id}
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

  // Helper function to show media file count
  const renderPhotoCount = (record) => {
    const media = getMediaFromWarehouse(record);
    const count = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0);
    return count === 0 ? '-' : `${count} file${count > 1 ? 's' : ''}`;
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

    } catch {
      // Revert the optimistic update on error
      setWarehouses(prev =>
        prev.map(w => w.id === warehouse.id ? warehouse : w)
      );
      // Error already handled by withRetry
    }
  }, [message]);

  // Right-click context menu
  const handleRowContextMenu = (record, event) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      record: record
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      record: null
    });
  };

  // Table columns configuration
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
      render: (id) => <span>#{id}</span>,
    },
    {
      title: 'Owner Type',
      dataIndex: 'warehouseOwnerType',
      key: 'warehouseOwnerType',
      width: 120,
      render: (text) => <span>{text || '-'}</span>,
    },
    {
      title: 'Warehouse Type',
      dataIndex: 'warehouseType',
      key: 'warehouseType',
      width: 140,
      sorter: (a, b) => (a.warehouseType || '').localeCompare(b.warehouseType || ''),
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
      width: 200,
      ellipsis: { showTitle: false },
      render: (address) => (
        <Tooltip title={address}>
          <span>{address}</span>
        </Tooltip>
      ),
    },
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      width: 120,
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'State',
      dataIndex: 'state',
      key: 'state',
      width: 120,
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Zone',
      dataIndex: 'zone',
      key: 'zone',
      width: 100,
      render: (zone) => <span>{zone}</span>,
    },
    {
      title: 'Contact Person',
      dataIndex: 'contactPerson',
      key: 'contactPerson',
      width: 140,
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Contact Number',
      key: 'contactNumber',
      width: 150,
      render: (_, record) => <RedactedPhone warehouseId={record.id} />,
    },
    {
      title: 'Offered Area',
      dataIndex: 'totalSpaceSqft',
      key: 'totalSpaceSqft',
      width: 150,
      sorter: (a, b) => {
        const aSpace = Array.isArray(a.totalSpaceSqft) ? a.totalSpaceSqft.reduce((sum, val) => sum + val, 0) : (a.totalSpaceSqft || 0);
        const bSpace = Array.isArray(b.totalSpaceSqft) ? b.totalSpaceSqft.reduce((sum, val) => sum + val, 0) : (b.totalSpaceSqft || 0);
        return aSpace - bSpace;
      },
      render: (space) => {
        if (!space) return '-';
        if (Array.isArray(space)) {
          return `[${space.join(', ')}]`;
        }
        return space.toString();
      },
    },
    {
      title: 'Offered Space',
      dataIndex: 'offeredSpaceSqft',
      key: 'offeredSpaceSqft',
      width: 120,
      render: (space) => {
        if (!space) return '-';
        // Handle both string format like "10000 sft" and number format
        const numericValue = typeof space === 'string'
          ? parseInt(space.replace(/[^\d]/g, ''))
          : parseInt(space);
        return numericValue ? `${numericValue.toLocaleString()} sq ft` : space;
      },
    },
    {
      title: 'Docks',
      dataIndex: 'numberOfDocks',
      key: 'numberOfDocks',
      width: 80,
      render: (docks) => <span>{docks || '-'}</span>,
    },
    {
      title: 'Height',
      dataIndex: 'clearHeightFt',
      key: 'clearHeightFt',
      width: 90,
      render: (height) => height ? `${height} ft` : '-',
    },
    {
      title: 'Rate/sq ft',
      dataIndex: 'ratePerSqft',
      key: 'ratePerSqft',
      width: 100,
      render: (rate) => {
        if (!rate) return '-';
        // Handle both string format like "Rs. 22/sft" and number format
        const numericValue = typeof rate === 'string'
          ? rate.replace(/[^\d.]/g, '')
          : rate;
        return numericValue ? `₹${numericValue}/sq ft` : rate;
      },
    },
    {
      title: 'Availability',
      dataIndex: 'availability',
      key: 'availability',
      width: 110,
      render: (availability) => <span>{availability || 'Unknown'}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => <span>{status || '-'}</span>,
    },
    {
      title: 'Handover Date',
      dataIndex: 'handoverDate',
      key: 'handoverDate',
      width: 130,
      render: (d) => <span>{d ? String(d).slice(0, 10) : '-'}</span>,
    },
    {
      title: 'Lock-in Date',
      dataIndex: 'lockInDate',
      key: 'lockInDate',
      width: 130,
      render: (d) => <span>{d ? String(d).slice(0, 10) : '-'}</span>,
    },
    {
      title: 'Broker',
      dataIndex: 'isBroker',
      key: 'isBroker',
      width: 80,
      render: (isBroker) => <span>{isBroker || 'No'}</span>,
    },
    {
      title: 'Fire NOC',
      key: 'fireNoc',
      width: 90,
      render: (_, record) => {
        const fireNoc = record.WarehouseData?.fireNocAvailable || record.warehouseData?.fireNocAvailable;
        return <span>{fireNoc ? 'Yes' : 'No'}</span>;
      },
    },
    {
      title: 'Land Type',
      key: 'landType',
      width: 130,
      render: (_, record) => {
        const landType = record.WarehouseData?.landType || record.warehouseData?.landType;
        return <span>{landType || '-'}</span>;
      },
    },
    {
      title: 'Postal Code',
      dataIndex: 'postalCode',
      key: 'postalCode',
      width: 100,
      render: (text) => <span>{text || '-'}</span>,
    },
    {
      title: 'Google Location',
      dataIndex: 'googleLocation',
      key: 'googleLocation',
      width: 120,
      render: (url) => url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
          View Map
        </a>
      ) : '-',
    },
    {
      title: 'Other Specs',
      dataIndex: 'otherSpecifications',
      key: 'otherSpecifications',
      width: 150,
      ellipsis: { showTitle: false },
      render: (text) => text ? (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: 'Fire Safety',
      key: 'fireSafetyMeasures',
      width: 120,
      render: (_, record) => {
        const fireSafety = record.WarehouseData?.fireSafetyMeasures || record.warehouseData?.fireSafetyMeasures;
        return <span>{fireSafety || '-'}</span>;
      },
    },
    {
      title: 'Approach Road',
      key: 'approachRoadWidth',
      width: 120,
      render: (_, record) => {
        const roadWidth = record.WarehouseData?.approachRoadWidth || record.warehouseData?.approachRoadWidth;
        return <span>{roadWidth ? `${roadWidth} ft` : '-'}</span>;
      },
    },
    {
      title: 'Power (KVA)',
      key: 'powerKva',
      width: 100,
      render: (_, record) => {
        const power = record.WarehouseData?.powerKva || record.warehouseData?.powerKva;
        return <span>{power ? `${power} KVA` : '-'}</span>;
      },
    },
    {
      title: 'Pollution Zone',
      key: 'pollutionZone',
      width: 120,
      render: (_, record) => {
        const zone = record.WarehouseData?.pollutionZone || record.warehouseData?.pollutionZone;
        return <span>{zone || '-'}</span>;
      },
    },
    {
      title: 'Vaastu',
      key: 'vaastuCompliance',
      width: 80,
      render: (_, record) => {
        const vaastu = record.WarehouseData?.vaastuCompliance || record.warehouseData?.vaastuCompliance;
        return <span>{vaastu ? 'Yes' : 'No'}</span>;
      },
    },
    {
      title: 'Media',
      key: 'media',
      width: 80,
      render: (_, record) => renderPhotoCount(record),
    },
    {
      title: 'Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 90,
      align: 'center',
      render: (visible) => {
        // Handle different data types for visibility
        const isVisible = visible === true || visible === 'true' || visible === 1;

        return (
          <span>{isVisible ? 'Visible' : 'Hidden'}</span>
        );
      },
    },
    {
      title: 'Uploaded By',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      width: 120,
      render: (text) => <span>{text}</span>,
    },
  ];

  return (
    <div style={{ padding: isMobile ? '8px' : '24px' }}>
      <Card
        style={{
          background: isMobile ? 'rgba(31, 31, 31, 0.85)' : 'rgba(31, 31, 31, 0.6)',
          backdropFilter: isMobile ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: isMobile ? 'none' : 'blur(20px)',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
        }}
        bodyStyle={isMobile ? { padding: '12px' } : undefined}
      >
        {/* Search Bar and Actions */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '10px' : '12px',
          marginBottom: isMobile ? '10px' : '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flex: 1,
            minWidth: isMobile ? '100%' : 'auto'
          }}>
            <Input
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

          <div style={{
            display: 'flex',
            gap: isMobile ? '8px' : '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto',
            justifyContent: isMobile ? 'space-between' : 'flex-end'
          }}>
            {/* Left control group: filter (mobile) + view switcher + map toggle */}
            <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', alignItems: 'center' }}>
              {isMobile && (
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => setFiltersVisible(!filtersVisible)}
                  type={filtersVisible ? 'primary' : 'default'}
                  size="small"
                  aria-label="Filters"
                />
              )}

              {/* View Switcher */}
              <ViewSwitcher
                currentView={currentView}
                onViewChange={changeView}
                disabled={loading}
                showLabels={!isMobile}
              />

              {/* Split View Toggle - only show for cards view */}
              {currentView === 'cards' && (
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
              )}
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

        {/* Desktop Filter Panel (shared component) */}
        {filtersVisible && !isMobile && <WarehouseFilterBar filters={filters} />}

        {error && (
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
          background: isMobile ? 'rgba(31, 31, 31, 0.7)' : 'rgba(31, 31, 31, 0.4)',
          backdropFilter: isMobile ? 'none' : 'blur(15px)',
          WebkitBackdropFilter: isMobile ? 'none' : 'blur(15px)',
          border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isMobile ? '0' : '8px',
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          opacity: isTransitioning ? 0.7 : 1
        }}>
          {/* Split View Layout - only for cards view */}
          {splitViewEnabled && currentView === 'cards' ? (
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '16px',
              padding: '16px',
              height: isMobile ? 'auto' : 'calc(100vh - 300px)'
            }}>
              {/* Cards View */}
              <div style={{
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
          ) : currentView === 'table' ? (
            <ResponsiveTable
              columns={columns}
              dataSource={Array.isArray(warehouses) ? warehouses : []}
              rowKey="id"
              onRow={(record) => ({
                onContextMenu: (event) => handleRowContextMenu(record, event),
                style: { cursor: 'context-menu' }
              })}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: total,
                showSizeChanger: !isMobile,
                showQuickJumper: !isMobile,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} warehouses`,
                position: ['bottomCenter'],
                onChange: (page, size) => {
                  setCurrentPage(page);
                  if (size !== pageSize) {
                    setPageSize(size);
                  }
                },
                onShowSizeChange: (current, size) => {
                  setCurrentPage(1);
                  setPageSize(size);
                },
                style: {
                  padding: isMobile ? '12px 16px' : '16px 24px',
                  background: 'var(--bg-header)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderTop: '1px solid var(--border-primary)',
                  margin: 0
                }
              }}
              scroll={{
                x: isMobile ? 1200 : 2400,
                y: isMobile ? 'calc(100vh - 300px)' : 'calc(100vh - 400px)',
                scrollToFirstRowOnChange: true
              }}
              loading={loading}
              className="dark-table"
            />
          ) : (
            <div style={{ padding: isMobile ? '4px' : '16px' }}>
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

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        onViewDetails={() => handleViewDetails(contextMenu.record)}
        onEdit={() => handleEdit(contextMenu.record)}
        onDelete={() => handleDelete(contextMenu.record)}
      />

      {/* Mobile Filter Drawer */}
      <MobileFilterDrawer
        visible={filtersVisible && isMobile}
        onClose={() => setFiltersVisible(false)}
        {...filters}
        activeFilterCount={
          (searchText ? 1 : 0) +
          (selectedOwnerType ? 1 : 0) +
          (selectedType ? 1 : 0) +
          (selectedCity ? 1 : 0) +
          (selectedState ? 1 : 0) +
          (selectedZone ? 1 : 0) +
          (selectedAvailability ? 1 : 0) +
          (selectedBroker ? 1 : 0) +
          (fireNocFilter ? 1 : 0) +
          (selectedLandType ? 1 : 0) +
          (selectedUploadedBy ? 1 : 0) +
          (selectedVisibility ? 1 : 0) +
          (areaRange[0] > 0 || areaRange[1] < 100000 ? 1 : 0) +
          (budgetRange[0] > 0 || budgetRange[1] < 1000 ? 1 : 0)
        }
      />
    </div>
  );
};

export default Dashboard;