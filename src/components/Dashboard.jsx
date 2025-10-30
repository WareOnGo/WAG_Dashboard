import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Typography, 
  Card, 
  Spin,
  Tooltip,
  App,
  Input,
  Select,
  Row,
  Col,
  Image,
  Slider,
  Tag
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
  CloseOutlined
} from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { WarehouseForm, ContextMenu } from './index';
import { 
  handleOperationError, 
  showSuccessMessage, 
  withRetry,
  clearErrors 
} from '../utils/errorHandler';

const { Title, Text } = Typography;

const Dashboard = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [filteredWarehouses, setFilteredWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Filter and search states
  const [searchText, setSearchText] = useState('');
  const [selectedOwnerType, setSelectedOwnerType] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [fireNocFilter, setFireNocFilter] = useState('');
  const [selectedLandType, setSelectedLandType] = useState('');
  const [selectedUploadedBy, setSelectedUploadedBy] = useState('');
  const [selectedVisibility, setSelectedVisibility] = useState('');
  const [areaRange, setAreaRange] = useState([0, 100000]);
  const [budgetRange, setBudgetRange] = useState([0, 1000]);
  
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Get modal instance from App context
  const { modal } = App.useApp();

  // Fetch warehouses on component mount
  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await withRetry(
        () => warehouseService.getAll(),
        { 
          operationType: 'fetch',
          maxRetries: 2,
          onError: (errorInfo) => setError(errorInfo.message)
        }
      );
      setWarehouses(data);
      setFilteredWarehouses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search functionality
  useEffect(() => {
    let filtered = [...warehouses];

    // Apply search filter
    if (searchText) {
      filtered = filtered.filter(warehouse =>
        warehouse.id?.toString().includes(searchText) ||
        warehouse.warehouseType?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.address?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.city?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.contactPerson?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.warehouseOwnerType?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Apply owner type filter
    if (selectedOwnerType) {
      filtered = filtered.filter(warehouse => 
        warehouse.warehouseOwnerType?.toLowerCase().includes(selectedOwnerType.toLowerCase())
      );
    }

    // Apply type filter
    if (selectedType) {
      filtered = filtered.filter(warehouse => 
        warehouse.warehouseType?.toLowerCase().includes(selectedType.toLowerCase())
      );
    }

    // Apply city filter
    if (selectedCity) {
      filtered = filtered.filter(warehouse => 
        warehouse.city?.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    // Apply state filter
    if (selectedState) {
      filtered = filtered.filter(warehouse => 
        warehouse.state?.toLowerCase().includes(selectedState.toLowerCase())
      );
    }

    // Apply zone filter
    if (selectedZone) {
      filtered = filtered.filter(warehouse => 
        warehouse.zone?.toLowerCase().includes(selectedZone.toLowerCase())
      );
    }

    // Apply availability filter
    if (selectedAvailability) {
      filtered = filtered.filter(warehouse => 
        warehouse.availability?.toLowerCase().includes(selectedAvailability.toLowerCase())
      );
    }

    // Apply broker filter
    if (selectedBroker) {
      filtered = filtered.filter(warehouse => 
        warehouse.isBroker?.toLowerCase().includes(selectedBroker.toLowerCase())
      );
    }

    // Apply fire NOC filter
    if (fireNocFilter) {
      filtered = filtered.filter(warehouse => {
        const fireNoc = warehouse.WarehouseData?.fireNocAvailable || warehouse.warehouseData?.fireNocAvailable;
        if (fireNocFilter === 'available') {
          return fireNoc === true;
        } else if (fireNocFilter === 'not_available') {
          return fireNoc === false || fireNoc === null || fireNoc === undefined;
        }
        return true;
      });
    }

    // Apply land type filter
    if (selectedLandType) {
      filtered = filtered.filter(warehouse => 
        (warehouse.WarehouseData?.landType || warehouse.warehouseData?.landType || '')
          .toLowerCase().includes(selectedLandType.toLowerCase())
      );
    }

    // Apply uploaded by filter
    if (selectedUploadedBy) {
      filtered = filtered.filter(warehouse => 
        warehouse.uploadedBy?.toLowerCase().includes(selectedUploadedBy.toLowerCase())
      );
    }

    // Apply visibility filter
    if (selectedVisibility) {
      filtered = filtered.filter(warehouse => {
        if (selectedVisibility === 'visible') {
          return warehouse.visibility === true;
        } else if (selectedVisibility === 'hidden') {
          return warehouse.visibility === false;
        }
        return true;
      });
    }

    // Apply area range filter
    if (areaRange[0] > 0 || areaRange[1] < 100000) {
      filtered = filtered.filter(warehouse => {
        const totalSpace = Array.isArray(warehouse.totalSpaceSqft) 
          ? warehouse.totalSpaceSqft[0] 
          : warehouse.totalSpaceSqft;
        return totalSpace >= areaRange[0] && totalSpace <= areaRange[1];
      });
    }

    // Apply budget range filter (rate per sq ft)
    if (budgetRange[0] > 0 || budgetRange[1] < 1000) {
      filtered = filtered.filter(warehouse => {
        const rate = parseFloat(warehouse.ratePerSqft?.replace(/[^\d.]/g, '') || 0);
        return rate >= budgetRange[0] && rate <= budgetRange[1];
      });
    }

    setFilteredWarehouses(filtered);
  }, [warehouses, searchText, selectedOwnerType, selectedType, selectedCity, selectedState, selectedZone, selectedAvailability, selectedBroker, fireNocFilter, selectedLandType, selectedUploadedBy, selectedVisibility, areaRange, budgetRange]);

  const clearFilters = () => {
    setSearchText('');
    setSelectedOwnerType('');
    setSelectedType('');
    setSelectedCity('');
    setSelectedState('');
    setSelectedZone('');
    setSelectedAvailability('');
    setSelectedBroker('');
    setFireNocFilter('');
    setSelectedLandType('');
    setSelectedUploadedBy('');
    setSelectedVisibility('');
    setAreaRange([0, 100000]);
    setBudgetRange([0, 1000]);
  };

  const handleDelete = (warehouse) => {
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
        } catch (err) {
          // Error already handled by withRetry
        }
      },
    });
  };

  const handleEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setFormVisible(true);
  };

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
            let result;
            
            if (editingWarehouse) {
              // Update existing warehouse
              result = await withRetry(
                () => warehouseService.update(editingWarehouse.id, formData),
                { 
                  operationType,
                  maxRetries: 1 // Don't retry validation errors
                }
              );
              
              // Update local state with updated warehouse
              setWarehouses(prev => 
                prev.map(w => w.id === editingWarehouse.id ? result : w)
              );
            } else {
              // Create new warehouse
              result = await withRetry(
                () => warehouseService.create(formData),
                { 
                  operationType,
                  maxRetries: 1 // Don't retry validation errors
                }
              );
              
              // Add new warehouse to local state
              setWarehouses(prev => [...prev, result]);
            }
            
            // Close form and reset state
            setFormVisible(false);
            setEditingWarehouse(null);
            showSuccessMessage(operationType);
            resolve(result);
            
          } catch (error) {
            // Error already handled by withRetry
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

  // Helper function to show photo count (not actual images to keep rows short)
  const renderPhotoCount = (photos) => {
    if (!photos) return '-';
    
    const imageUrls = photos.split(',').map(url => url.trim()).filter(url => url);
    
    if (imageUrls.length === 0) return '-';
    
    return `${imageUrls.length} photo${imageUrls.length > 1 ? 's' : ''}`;
  };

  // Handle view details
  const handleViewDetails = (warehouse) => {
    setSelectedWarehouse(warehouse);
    setViewDetailsVisible(true);
  };

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
      dataIndex: 'contactNumber',
      key: 'contactNumber',
      width: 130,
      render: (text) => <span>{text}</span>,
    },
    {
      title: 'Total Space',
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
      title: 'Photos',
      key: 'photos',
      width: 80,
      render: (_, record) => renderPhotoCount(record.photos),
    },
    {
      title: 'Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 90,
      align: 'center',
      render: (visible) => (
        <span>{visible ? 'Visible' : 'Hidden'}</span>
      ),
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
    <div style={{ padding: '24px' }}>
      <Card
        style={{
          background: 'rgba(31, 31, 31, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* Search Bar and Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '16px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
            <Input
              placeholder="Search warehouses..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: '400px' }}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFiltersVisible(!filtersVisible)}
              type={filtersVisible ? 'primary' : 'default'}
            >
              Filters
            </Button>
            <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '14px' }}>
              {filteredWarehouses.length} of {warehouses.length} results
            </div>
          </div>
          
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            size="large"
          >
            Add Warehouse
          </Button>
        </div>

        {/* Collapsible Filter Panel */}
        {filtersVisible && (
          <Card
            size="small"
            style={{
              background: 'rgba(31, 31, 31, 0.4)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '16px'
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Owner Type
                </div>
                <Input
                  placeholder="Filter by owner type"
                  value={selectedOwnerType}
                  onChange={(e) => setSelectedOwnerType(e.target.value)}
                  allowClear
                />
              </Col>
              
              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Warehouse Type
                </div>
                <Input
                  placeholder="Filter by warehouse type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  City
                </div>
                <Input
                  placeholder="Filter by city"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  State
                </div>
                <Input
                  placeholder="Filter by state"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Zone
                </div>
                <Select
                  placeholder="Select zone"
                  value={selectedZone || undefined}
                  onChange={setSelectedZone}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="NORTH">North</Option>
                  <Option value="SOUTH">South</Option>
                  <Option value="EAST">East</Option>
                  <Option value="WEST">West</Option>
                  <Option value="CENTRAL">Central</Option>
                </Select>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Availability
                </div>
                <Input
                  placeholder="Filter by availability"
                  value={selectedAvailability}
                  onChange={(e) => setSelectedAvailability(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Broker Status
                </div>
                <Select
                  placeholder="Select broker status"
                  value={selectedBroker || undefined}
                  onChange={setSelectedBroker}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="y">Y</Option>
                  <Option value="n">N</Option>
                </Select>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Fire NOC
                </div>
                <Select
                  placeholder="Select Fire NOC status"
                  value={fireNocFilter || undefined}
                  onChange={setFireNocFilter}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="available">Available</Option>
                  <Option value="not_available">Not Available</Option>
                </Select>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Land Type
                </div>
                <Input
                  placeholder="Filter by land type"
                  value={selectedLandType}
                  onChange={(e) => setSelectedLandType(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Uploaded By
                </div>
                <Input
                  placeholder="Filter by uploader"
                  value={selectedUploadedBy}
                  onChange={(e) => setSelectedUploadedBy(e.target.value)}
                  allowClear
                />
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Area Range (sq ft)
                </div>
                <Slider
                  range
                  min={0}
                  max={100000}
                  step={1000}
                  value={areaRange}
                  onChange={setAreaRange}
                  tooltip={{
                    formatter: (value) => `${value.toLocaleString()} sq ft`
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
                  <span>{areaRange[0].toLocaleString()}</span>
                  <span>{areaRange[1].toLocaleString()}</span>
                </div>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Budget Range (₹/sq ft)
                </div>
                <Slider
                  range
                  min={0}
                  max={1000}
                  step={5}
                  value={budgetRange}
                  onChange={setBudgetRange}
                  tooltip={{
                    formatter: (value) => `₹${value}/sq ft`
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
                  <span>₹{budgetRange[0]}</span>
                  <span>₹{budgetRange[1]}</span>
                </div>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <div style={{ marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  Visibility
                </div>
                <Select
                  placeholder="Select visibility"
                  value={selectedVisibility || undefined}
                  onChange={setSelectedVisibility}
                  allowClear
                  style={{ width: '100%' }}
                >
                  <Option value="visible">Visible</Option>
                  <Option value="hidden">Hidden</Option>
                </Select>
              </Col>

              <Col xs={24} sm={12} md={8} lg={6}>
                <Button
                  onClick={clearFilters}
                  style={{ marginTop: '20px' }}
                >
                  Clear All Filters
                </Button>
              </Col>
            </Row>
          </Card>
        )}

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
          background: 'rgba(31, 31, 31, 0.4)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <Spin spinning={loading} tip="Loading warehouses...">
            <Table
              columns={columns}
              dataSource={filteredWarehouses}
              rowKey="id"
              onRow={(record) => ({
                onContextMenu: (event) => handleRowContextMenu(record, event),
                style: { cursor: 'context-menu' }
              })}
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
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
                  setCurrentPage(1); // Reset to first page when changing page size
                  setPageSize(size);
                  console.log('Page size changed to:', size);
                },
                style: {
                  padding: '16px 24px',
                  background: 'var(--bg-header)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  borderTop: '1px solid var(--border-primary)',
                  margin: 0
                }
              }}
              scroll={{ 
                x: 2400, 
                y: 'calc(100vh - 400px)',
                scrollToFirstRowOnChange: true
              }}
              style={{
                background: 'transparent',
              }}
              className="dark-table"
            />
          </Spin>
        </div>
      </Card>

      {/* Warehouse Form Modal */}
      <WarehouseForm
        visible={formVisible}
        onCancel={handleFormCancel}
        onSubmit={handleFormSubmit}
        initialData={editingWarehouse}
        loading={formLoading}
      />

      {/* View Details Modal */}
      {selectedWarehouse && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: viewDetailsVisible ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setViewDetailsVisible(false)}
        >
          <Card
            style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              background: 'rgba(31, 31, 31, 0.8)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <Title 
                level={3} 
                style={{ 
                  color: '#fff', 
                  margin: 0 
                }}
              >
                Warehouse Details - #{selectedWarehouse.id}
              </Title>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setViewDetailsVisible(false)}
                style={{ color: 'rgba(255, 255, 255, 0.65)' }}
              />
            </div>

            <Row gutter={[24, 16]}>
              {/* Basic Information */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
                  Basic Information
                </Title>
              </Col>
              
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>WAREHOUSE OWNER TYPE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.warehouseOwnerType || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>WAREHOUSE TYPE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.warehouseType}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>ZONE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.zone}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>VISIBILITY</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.visibility ? 'Visible' : 'Hidden'}
                  </div>
                </div>
              </Col>

              {/* Address Information */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                  Address Information
                </Title>
              </Col>

              <Col xs={24}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>ADDRESS</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.address}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>CITY</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.city}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>STATE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.state}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>POSTAL CODE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.postalCode || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>GOOGLE LOCATION</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.googleLocation ? (
                      <a href={selectedWarehouse.googleLocation} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                        View on Google Maps
                      </a>
                    ) : '-'}
                  </div>
                </div>
              </Col>

              {/* Contact Information */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                  Contact Information
                </Title>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>CONTACT PERSON</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.contactPerson}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>CONTACT NUMBER</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.contactNumber}
                  </div>
                </div>
              </Col>

              {/* Warehouse Details */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                  Warehouse Details
                </Title>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>TOTAL SPACE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {Array.isArray(selectedWarehouse.totalSpaceSqft) 
                      ? `[${selectedWarehouse.totalSpaceSqft.join(', ')}] sq ft`
                      : `${selectedWarehouse.totalSpaceSqft?.toLocaleString()} sq ft`}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>OFFERED SPACE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.offeredSpaceSqft || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>RATE PER SQ FT</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.ratePerSqft}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>NUMBER OF DOCKS</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.numberOfDocks || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>CLEAR HEIGHT</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.clearHeightFt || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>AVAILABILITY</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.availability || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={8}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>IS BROKER</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.isBroker || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>OTHER SPECIFICATIONS</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.otherSpecifications || '-'}
                  </div>
                </div>
              </Col>

              {/* Location Data */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                  Location Data
                </Title>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>LATITUDE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.latitude || selectedWarehouse.warehouseData?.latitude)
                      ? parseFloat(selectedWarehouse.WarehouseData?.latitude || selectedWarehouse.warehouseData?.latitude).toFixed(6)
                      : '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>LONGITUDE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.longitude || selectedWarehouse.warehouseData?.longitude)
                      ? parseFloat(selectedWarehouse.WarehouseData?.longitude || selectedWarehouse.warehouseData?.longitude).toFixed(6)
                      : '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>FIRE NOC AVAILABLE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.fireNocAvailable || selectedWarehouse.warehouseData?.fireNocAvailable) ? 'Yes' : 'No'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>FIRE SAFETY MEASURES</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.fireSafetyMeasures || selectedWarehouse.warehouseData?.fireSafetyMeasures) || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>LAND TYPE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.landType || selectedWarehouse.warehouseData?.landType) || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>APPROACH ROAD WIDTH</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.approachRoadWidth || selectedWarehouse.warehouseData?.approachRoadWidth) 
                      ? `${selectedWarehouse.WarehouseData?.approachRoadWidth || selectedWarehouse.warehouseData?.approachRoadWidth} ft` 
                      : '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>POWER (KVA)</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.powerKva || selectedWarehouse.warehouseData?.powerKva) 
                      ? `${selectedWarehouse.WarehouseData?.powerKva || selectedWarehouse.warehouseData?.powerKva} KVA` 
                      : '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>POLLUTION ZONE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.pollutionZone || selectedWarehouse.warehouseData?.pollutionZone) || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>VAASTU COMPLIANCE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.vaastuCompliance || selectedWarehouse.warehouseData?.vaastuCompliance) || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>DIMENSIONS</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.dimensions || selectedWarehouse.warehouseData?.dimensions) || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>PARKING & DOCKING SPACE</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {(selectedWarehouse.WarehouseData?.parkingDockingSpace || selectedWarehouse.warehouseData?.parkingDockingSpace) || '-'}
                  </div>
                </div>
              </Col>

              {/* Photos */}
              {selectedWarehouse.photos && (
                <>
                  <Col xs={24}>
                    <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                      Warehouse Photos
                    </Title>
                  </Col>
                  <Col xs={24}>
                    <div style={{ marginBottom: '12px' }}>
                      {(() => {
                        const imageUrls = selectedWarehouse.photos.split(',').map(url => url.trim()).filter(url => url);
                        return imageUrls.length > 0 ? (
                          <Row gutter={[8, 8]}>
                            <Image.PreviewGroup>
                              {imageUrls.map((url, index) => (
                                <Col key={index} xs={12} sm={8} md={6}>
                                  <Image
                                    src={url}
                                    alt={`Warehouse image ${index + 1}`}
                                    style={{ 
                                      width: '100%', 
                                      height: '120px', 
                                      objectFit: 'cover',
                                      borderRadius: '6px',
                                      border: '1px solid #303030'
                                    }}
                                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                                  />
                                </Col>
                              ))}
                            </Image.PreviewGroup>
                          </Row>
                        ) : (
                          <Text style={{ color: 'rgba(255, 255, 255, 0.65)' }}>No photos available</Text>
                        );
                      })()}
                    </div>
                  </Col>
                </>
              )}

              {/* Additional Information */}
              <Col xs={24}>
                <Title level={5} style={{ color: '#fff', marginTop: '16px', marginBottom: '16px' }}>
                  Additional Information
                </Title>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>UPLOADED BY</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.uploadedBy || '-'}
                  </div>
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <div style={{ marginBottom: '12px' }}>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>COMPLIANCES</Text>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                    {selectedWarehouse.compliances || '-'}
                  </div>
                </div>
              </Col>

              {selectedWarehouse.createdAt && (
                <Col xs={24} sm={12}>
                  <div style={{ marginBottom: '12px' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>CREATED</Text>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                      {new Date(selectedWarehouse.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </Col>
              )}

              {selectedWarehouse.updatedAt && (
                <Col xs={24} sm={12}>
                  <div style={{ marginBottom: '12px' }}>
                    <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>LAST UPDATED</Text>
                    <div style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>
                      {new Date(selectedWarehouse.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                </Col>
              )}
            </Row>

            <div style={{ 
              marginTop: '32px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <Button
                onClick={() => {
                  setViewDetailsVisible(false);
                  handleEdit(selectedWarehouse);
                }}
                type="primary"
                icon={<EditOutlined />}
              >
                Edit Warehouse
              </Button>
              <Button
                onClick={() => setViewDetailsVisible(false)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

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
    </div>
  );
};

export default Dashboard;