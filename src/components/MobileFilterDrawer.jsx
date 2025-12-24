import React, { useState } from 'react';
import { 
  Drawer, 
  Button, 
  Input, 
  Select, 
  Row, 
  Col, 
  Slider, 
  Typography, 
  Collapse,
  Badge,
  Space,
  Spin
} from 'antd';
import { 
  FilterOutlined, 
  CloseOutlined, 
  ClearOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';
import './MobileFilterDrawer.css';

const { Option } = Select;
const { Panel } = Collapse;
const { Text } = Typography;

const MobileFilterDrawer = ({
  visible,
  onClose,
  searchText,
  setSearchText,
  selectedOwnerType,
  setSelectedOwnerType,
  selectedType,
  setSelectedType,
  selectedCity,
  setSelectedCity,
  selectedState,
  setSelectedState,
  selectedZone,
  setSelectedZone,
  selectedAvailability,
  setSelectedAvailability,
  selectedBroker,
  setSelectedBroker,
  fireNocFilter,
  setFireNocFilter,
  selectedLandType,
  setSelectedLandType,
  selectedUploadedBy,
  setSelectedUploadedBy,
  selectedVisibility,
  setSelectedVisibility,
  areaRange,
  setAreaRange,
  budgetRange,
  setBudgetRange,
  clearFilters,
  activeFilterCount
}) => {
  const { isMobile } = useViewport();
  const [activeKeys, setActiveKeys] = useState(['basic', 'location', 'details']);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  // Calculate active filters for each section
  const getBasicFiltersCount = () => {
    let count = 0;
    if (selectedOwnerType) count++;
    if (selectedType) count++;
    if (selectedAvailability) count++;
    if (selectedBroker) count++;
    return count;
  };

  const getLocationFiltersCount = () => {
    let count = 0;
    if (selectedCity) count++;
    if (selectedState) count++;
    if (selectedZone) count++;
    return count;
  };

  const getDetailsFiltersCount = () => {
    let count = 0;
    if (fireNocFilter) count++;
    if (selectedLandType) count++;
    if (selectedUploadedBy) count++;
    if (selectedVisibility) count++;
    if (areaRange[0] > 0 || areaRange[1] < 100000) count++;
    if (budgetRange[0] > 0 || budgetRange[1] < 1000) count++;
    return count;
  };

  const handleCollapseChange = (keys) => {
    setActiveKeys(keys);
  };

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    
    // Simulate filter processing time for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setIsApplyingFilters(false);
    onClose();
  };

  const handleQuickFilterChange = (filterType, value) => {
    // Add visual feedback for quick filter changes
    setIsApplyingFilters(true);
    
    setTimeout(() => {
      switch (filterType) {
        case 'zone':
          setSelectedZone(selectedZone === value ? '' : value);
          break;
        case 'fireNoc':
          setFireNocFilter(fireNocFilter === value ? '' : value);
          break;
        case 'broker':
          setSelectedBroker(selectedBroker === value ? '' : value);
          break;
        case 'visibility':
          setSelectedVisibility(selectedVisibility === value ? '' : value);
          break;
        default:
          break;
      }
      setIsApplyingFilters(false);
    }, 150);
  };

  return (
    <Drawer
      title={
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%'
        }}>
          <Space>
            <FilterOutlined />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Badge 
                count={activeFilterCount} 
                style={{ 
                  backgroundColor: 'var(--accent-primary)',
                  fontSize: '11px'
                }} 
              />
            )}
          </Space>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ 
              color: 'rgba(255, 255, 255, 0.65)',
              border: 'none',
              boxShadow: 'none'
            }}
          />
        </div>
      }
      placement="bottom"
      height={isMobile ? '85vh' : '70vh'}
      open={visible}
      onClose={onClose}
      closable={false}
      className="mobile-filter-drawer"
      styles={{
        body: { 
          padding: '16px',
          background: 'var(--bg-primary)',
          color: '#fff'
        },
        header: {
          background: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-primary)',
          color: '#fff'
        }
      }}
      extra={null}
    >
      <div style={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Loading overlay */}
        {isApplyingFilters && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '8px'
          }}>
            <Spin size="large" />
          </div>
        )}
        {/* Search Section - Always visible */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <Text style={{ 
              color: 'rgba(255, 255, 255, 0.65)', 
              fontSize: '12px'
            }}>
              SEARCH
            </Text>
            {searchText && (
              <Badge 
                count={1} 
                style={{ 
                  backgroundColor: 'var(--accent-primary)',
                  fontSize: '10px'
                }} 
              />
            )}
          </div>
          <Input
            placeholder="Search warehouses..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ 
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              height: '44px'
            }}
          />
        </div>

        {/* Quick Filters - Horizontal scrolling chips */}
        <div style={{ marginBottom: '20px' }}>
          <Text style={{ 
            color: 'rgba(255, 255, 255, 0.65)', 
            fontSize: '12px',
            display: 'block',
            marginBottom: '12px'
          }}>
            QUICK FILTERS
          </Text>
          <div style={{ 
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent'
          }}>
            {/* Zone Quick Filters */}
            {['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'].map(zone => (
              <Button
                key={zone}
                size="small"
                type={selectedZone === zone ? 'primary' : 'default'}
                onClick={() => handleQuickFilterChange('zone', zone)}
                loading={isApplyingFilters}
                style={{
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  height: '32px',
                  fontSize: '12px',
                  borderRadius: '16px',
                  background: selectedZone === zone ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                  borderColor: selectedZone === zone ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)',
                  color: selectedZone === zone ? '#000' : '#fff'
                }}
              >
                {zone}
              </Button>
            ))}
            
            {/* Fire NOC Quick Filters */}
            <Button
              size="small"
              type={fireNocFilter === 'available' ? 'primary' : 'default'}
              onClick={() => handleQuickFilterChange('fireNoc', 'available')}
              loading={isApplyingFilters}
              style={{
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                height: '32px',
                fontSize: '12px',
                borderRadius: '16px',
                background: fireNocFilter === 'available' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: fireNocFilter === 'available' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)',
                color: fireNocFilter === 'available' ? '#000' : '#fff'
              }}
            >
              Fire NOC ✓
            </Button>
            
            {/* Broker Status Quick Filters */}
            <Button
              size="small"
              type={selectedBroker === 'y' ? 'primary' : 'default'}
              onClick={() => handleQuickFilterChange('broker', 'y')}
              loading={isApplyingFilters}
              style={{
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                height: '32px',
                fontSize: '12px',
                borderRadius: '16px',
                background: selectedBroker === 'y' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: selectedBroker === 'y' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)',
                color: selectedBroker === 'y' ? '#000' : '#fff'
              }}
            >
              Broker
            </Button>
            
            {/* Visibility Quick Filters */}
            <Button
              size="small"
              type={selectedVisibility === 'visible' ? 'primary' : 'default'}
              onClick={() => handleQuickFilterChange('visibility', 'visible')}
              loading={isApplyingFilters}
              style={{
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                height: '32px',
                fontSize: '12px',
                borderRadius: '16px',
                background: selectedVisibility === 'visible' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                borderColor: selectedVisibility === 'visible' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.12)',
                color: selectedVisibility === 'visible' ? '#000' : '#fff'
              }}
            >
              Visible
            </Button>
          </div>
        </div>

        {/* Collapsible Filter Sections */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Collapse
            activeKey={activeKeys}
            onChange={handleCollapseChange}
            ghost
            expandIcon={({ isActive }) => 
              isActive ? <UpOutlined /> : <DownOutlined />
            }
            style={{ 
              background: 'transparent',
              border: 'none'
            }}
          >
            {/* Basic Filters */}
            <Panel 
              header={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <Text style={{ color: '#fff', fontWeight: 500 }}>
                    Basic Filters
                  </Text>
                  {getBasicFiltersCount() > 0 && (
                    <Badge 
                      count={getBasicFiltersCount()} 
                      style={{ 
                        backgroundColor: 'var(--accent-primary)',
                        fontSize: '11px'
                      }} 
                    />
                  )}
                </div>
              }
              key="basic"
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                marginBottom: '12px'
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Owner Type
                    </Text>
                    {selectedOwnerType && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by owner type"
                    value={selectedOwnerType}
                    onChange={(e) => setSelectedOwnerType(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedOwnerType ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedOwnerType ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>
                
                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Warehouse Type
                    </Text>
                    {selectedType && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by warehouse type"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedType ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedType ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Availability
                    </Text>
                    {selectedAvailability && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by availability"
                    value={selectedAvailability}
                    onChange={(e) => setSelectedAvailability(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedAvailability ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedAvailability ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Broker Status
                    </Text>
                    {selectedBroker && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Select
                    placeholder="Select broker status"
                    value={selectedBroker || undefined}
                    onChange={setSelectedBroker}
                    allowClear
                    style={{ 
                      width: '100%', 
                      height: '44px'
                    }}
                    popupClassName="mobile-filter-select"
                  >
                    <Option value="y">Y</Option>
                    <Option value="n">N</Option>
                  </Select>
                </Col>
              </Row>
            </Panel>

            {/* Location Filters */}
            <Panel 
              header={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <Text style={{ color: '#fff', fontWeight: 500 }}>
                    Location Filters
                  </Text>
                  {getLocationFiltersCount() > 0 && (
                    <Badge 
                      count={getLocationFiltersCount()} 
                      style={{ 
                        backgroundColor: 'var(--accent-primary)',
                        fontSize: '11px'
                      }} 
                    />
                  )}
                </div>
              }
              key="location"
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                marginBottom: '12px'
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      City
                    </Text>
                    {selectedCity && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by city"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedCity ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedCity ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      State
                    </Text>
                    {selectedState && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by state"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedState ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedState ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Zone
                    </Text>
                    {selectedZone && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Select
                    placeholder="Select zone"
                    value={selectedZone || undefined}
                    onChange={setSelectedZone}
                    allowClear
                    style={{ 
                      width: '100%', 
                      height: '44px'
                    }}
                    popupClassName="mobile-filter-select"
                  >
                    <Option value="NORTH">North</Option>
                    <Option value="SOUTH">South</Option>
                    <Option value="EAST">East</Option>
                    <Option value="WEST">West</Option>
                    <Option value="CENTRAL">Central</Option>
                  </Select>
                </Col>
              </Row>
            </Panel>

            {/* Detailed Filters */}
            <Panel 
              header={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  width: '100%'
                }}>
                  <Text style={{ color: '#fff', fontWeight: 500 }}>
                    Detailed Filters
                  </Text>
                  {getDetailsFiltersCount() > 0 && (
                    <Badge 
                      count={getDetailsFiltersCount()} 
                      style={{ 
                        backgroundColor: 'var(--accent-primary)',
                        fontSize: '11px'
                      }} 
                    />
                  )}
                </div>
              }
              key="details"
              style={{ 
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                marginBottom: '12px'
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Fire NOC
                    </Text>
                    {fireNocFilter && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Select
                    placeholder="Select Fire NOC status"
                    value={fireNocFilter || undefined}
                    onChange={setFireNocFilter}
                    allowClear
                    style={{ 
                      width: '100%', 
                      height: '44px'
                    }}
                    popupClassName="mobile-filter-select"
                  >
                    <Option value="available">Available</Option>
                    <Option value="not_available">Not Available</Option>
                  </Select>
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Land Type
                    </Text>
                    {selectedLandType && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by land type"
                    value={selectedLandType}
                    onChange={(e) => setSelectedLandType(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedLandType ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedLandType ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Uploaded By
                    </Text>
                    {selectedUploadedBy && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Input
                    placeholder="Filter by uploader"
                    value={selectedUploadedBy}
                    onChange={(e) => setSelectedUploadedBy(e.target.value)}
                    allowClear
                    style={{ 
                      background: selectedUploadedBy ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'rgba(255, 255, 255, 0.08)',
                      border: selectedUploadedBy ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      height: '44px'
                    }}
                  />
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Visibility
                    </Text>
                    {selectedVisibility && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <Select
                    placeholder="Select visibility"
                    value={selectedVisibility || undefined}
                    onChange={setSelectedVisibility}
                    allowClear
                    style={{ 
                      width: '100%', 
                      height: '44px'
                    }}
                    popupClassName="mobile-filter-select"
                  >
                    <Option value="visible">Visible</Option>
                    <Option value="hidden">Hidden</Option>
                  </Select>
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Area Range (sq ft)
                    </Text>
                    {(areaRange[0] > 0 || areaRange[1] < 100000) && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <div style={{ padding: '12px 0' }}>
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
                      styles={{
                        track: { backgroundColor: 'var(--accent-primary)' },
                        handle: { borderColor: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary)' }
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '8px' }}>
                      <span>{areaRange[0].toLocaleString()}</span>
                      <span>{areaRange[1].toLocaleString()}</span>
                    </div>
                  </div>
                </Col>

                <Col xs={24}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '4px'
                  }}>
                    <Text style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Budget Range (₹/sq ft)
                    </Text>
                    {(budgetRange[0] > 0 || budgetRange[1] < 1000) && (
                      <Badge 
                        count="●" 
                        style={{ 
                          backgroundColor: 'var(--accent-primary)',
                          fontSize: '8px',
                          minWidth: '12px',
                          height: '12px',
                          lineHeight: '10px'
                        }} 
                      />
                    )}
                  </div>
                  <div style={{ padding: '12px 0' }}>
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
                      styles={{
                        track: { backgroundColor: 'var(--accent-primary)' },
                        handle: { borderColor: 'var(--accent-primary)', backgroundColor: 'var(--accent-primary)' }
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '8px' }}>
                      <span>₹{budgetRange[0]}</span>
                      <span>₹{budgetRange[1]}</span>
                    </div>
                  </div>
                </Col>
              </Row>
            </Panel>
          </Collapse>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div style={{ 
          borderTop: '1px solid var(--border-primary)',
          paddingTop: '16px',
          marginTop: '16px',
          display: 'flex',
          gap: '12px'
        }}>
          <Button
            onClick={clearFilters}
            icon={<ClearOutlined />}
            style={{ 
              flex: 1,
              height: '44px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff'
            }}
          >
            Clear All
          </Button>
          <Button
            type="primary"
            onClick={handleApplyFilters}
            loading={isApplyingFilters}
            style={{ 
              flex: 2,
              height: '44px'
            }}
          >
            {isApplyingFilters ? 'Applying...' : 'Apply Filters'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
};

export default MobileFilterDrawer;