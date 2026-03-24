import React, { useState } from 'react';
import { Layout, Typography, Button, Dropdown, Avatar, Tooltip, Modal, Input, message } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  MenuOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { warehouseService } from '../services/warehouseService';

const { Header } = Layout;
const { Text } = Typography;
const { TextArea } = Input;

const MobileHeader = ({ onMenuToggle }) => {
  const { isMobile } = useViewport();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [itineraryExpanded, setItineraryExpanded] = useState(false);
  const [itineraryResultOpen, setItineraryResultOpen] = useState(false);
  const [warehouseIds, setWarehouseIds] = useState('');
  const [generatedItinerary, setGeneratedItinerary] = useState('');
  const [warehouses, setWarehouses] = useState(null);
  const [generatingItinerary, setGeneratingItinerary] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      message.success('Successfully logged out');
    } catch (error) {
      console.error('Logout error:', error);
      message.error('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Toggle the inline itinerary input in the navbar
  const handleItineraryToggle = async () => {
    const opening = !itineraryExpanded;
    setItineraryExpanded(opening);

    // Fetch warehouses on first expand (lazy load)
    if (opening && !warehouses) {
      try {
        const data = await warehouseService.getAll();
        setWarehouses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
        message.error('Failed to load warehouse data');
      }
    }
  };

  // Generate itinerary from comma-separated IDs
  const handleGenerateItinerary = () => {
    if (!warehouseIds.trim()) {
      message.warning('Please enter warehouse IDs');
      return;
    }

    if (!warehouses || warehouses.length === 0) {
      message.error('Warehouse data not loaded');
      return;
    }

    setGeneratingItinerary(true);

    try {
      // Parse IDs from input
      const ids = warehouseIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id)
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id));

      if (ids.length === 0) {
        message.warning('No valid warehouse IDs found');
        setGeneratingItinerary(false);
        return;
      }

      // Find warehouses by IDs
      const foundWarehouses = ids
        .map(id => warehouses.find(w => w.id === id))
        .filter(w => w !== undefined);

      if (foundWarehouses.length === 0) {
        message.warning('No warehouses found for the given IDs');
        setGeneratingItinerary(false);
        return;
      }

      // Generate formatted itinerary
      const itineraryLines = foundWarehouses.map((wh, index) => {
        // Handle totalSpaceSqft (can be array or single value)
        const totalSpace = Array.isArray(wh.totalSpaceSqft)
          ? wh.totalSpaceSqft.join(' + ')
          : wh.totalSpaceSqft || 'N/A';

        // Read fields from both root and nested shapes for backward compatibility.
        const complianceValue = wh.compliances || wh.WarehouseData?.compliances || wh.warehouseData?.compliances;
        const otherSpecsValue = wh.otherSpecifications || wh.WarehouseData?.otherSpecifications || wh.warehouseData?.otherSpecifications;
        const compliances = typeof complianceValue === 'string' ? complianceValue.trim() : complianceValue;
        const otherSpecifications = typeof otherSpecsValue === 'string' ? otherSpecsValue.trim() : otherSpecsValue;

        // Render rate as-is from DB for now.
        const rate = wh.ratePerSqft;

        // Format address
        const addressParts = [
          wh.address,
          wh.city,
          wh.state,
          wh.postalCode
        ].filter(part => part); // Remove empty/null values
        const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';

        return `${index + 1}. WH-${wh.id} - ${wh.contactPerson || 'N/A'} (${wh.contactNumber || 'N/A'})
   Address: ${fullAddress}
   Total Space: ${totalSpace} sq ft
   Docks: ${wh.numberOfDocks || 0}
  Compliances: ${compliances || 'N/A'}
  Other Specs: ${otherSpecifications || 'N/A'}
  Rate: ${rate ?? ''}
   Location: ${wh.googleLocation || 'No location available'}`;
      });

      const itinerary = itineraryLines.join('\n\n');
      setGeneratedItinerary(itinerary);
      setItineraryResultOpen(true);
      message.success(`Generated itinerary for ${foundWarehouses.length} warehouse(s)`);

      // Show warning for missing IDs
      const missingCount = ids.length - foundWarehouses.length;
      if (missingCount > 0) {
        message.warning(`${missingCount} warehouse ID(s) not found`);
      }
    } catch (error) {
      console.error('Error generating itinerary:', error);
      message.error('Failed to generate itinerary');
    } finally {
      setGeneratingItinerary(false);
    }
  };

  // Copy itinerary to clipboard
  const handleCopyItinerary = async () => {
    if (!generatedItinerary) {
      message.warning('No itinerary to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedItinerary);
      message.success('Copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      message.error('Failed to copy to clipboard');
    }
  };

  // Close only the result modal — don't reset input so context is preserved
  const handleResultClose = () => {
    setItineraryResultOpen(false);
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: isLoggingOut ? 'Signing out...' : 'Sign Out',
      onClick: handleLogout,
      disabled: isLoggingOut,
      danger: true,
    },
  ];

  const linkItems = [
    { key: 'ppt-generator', icon: <FileTextOutlined />, label: 'PPT Generator', href: 'https://radiant-phoenix-e19499.netlify.app/', external: true, tooltip: 'Open internal PPT generator tool' },
  ];

  const itineraryTooltip = 'Generate copy-pastable itinerary details for on-ground teams';

  return (
    <>
      <Header
        className="modern-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${isMobile ? '16px' : '32px'}`,
          height: isMobile ? '64px' : '60px',
          background: 'rgba(18, 18, 18, 0.8)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-sticky)',
          paddingTop: isMobile ? 'env(safe-area-inset-top, 0)' : '0',
        }}
      >
        {/* Left section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={onMenuToggle}
              className="hamburger-menu-btn"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                borderRadius: '10px',
                color: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
              }}
              aria-label="Toggle navigation menu"
            />
          )}

          <a
            href="https://wareongo.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}
            className="brand-link"
          >
            <Text
              strong
              style={{
                color: '#fff',
                margin: 0,
                fontSize: isMobile ? '17px' : '18px',
                fontWeight: 600,
                letterSpacing: '-0.3px',
              }}
            >
              WareOnGo
            </Text>
          </a>

          {/* Desktop nav links */}
          {!isMobile && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '28px' }}>
              {linkItems.map((item) => (
                <Tooltip key={item.key} title={item.tooltip} placement="bottom">
                  <a
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="nav-link-btn"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'rgba(255, 255, 255, 0.5)',
                      transition: 'color 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '13px', display: 'flex' }}>{item.icon}</span>
                    {item.label}
                  </a>
                </Tooltip>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0px' }}>
                <Tooltip title={itineraryTooltip} placement="bottom">
                  <a
                    href="#"
                    className="nav-link-btn"
                    onClick={(e) => { e.preventDefault(); handleItineraryToggle(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: itineraryExpanded ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.5)',
                      transition: 'color 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', display: 'flex' }}><EnvironmentOutlined /></span>
                    Itinerary
                  </a>
                </Tooltip>
                {itineraryExpanded && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginLeft: '6px',
                    animation: 'itinerary-expand 0.2s ease-out',
                  }}>
                    <Input
                      value={warehouseIds}
                      onChange={(e) => setWarehouseIds(e.target.value)}
                      placeholder="Warehouse IDs (e.g. 1, 5, 12)"
                      size="small"
                      onPressEnter={handleGenerateItinerary}
                      disabled={generatingItinerary}
                      style={{
                        width: '220px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Button
                      type="primary"
                      size="small"
                      onClick={handleGenerateItinerary}
                      loading={generatingItinerary}
                      style={{ borderRadius: '6px', fontSize: '12px' }}
                    >
                      Generate
                    </Button>
                  </div>
                )}
              </div>
            </nav>
          )}
        </div>

        {/* Right section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px' }}>
          {/* Mobile icon links */}
          {isMobile && (
            <>
              {linkItems.map((item) => (
                <Tooltip key={item.key} title={item.tooltip} placement="bottom">
                  <a
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="nav-link-btn"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px',
                      transition: 'all 0.2s ease',
                      color: 'rgba(255, 255, 255, 0.45)',
                      background: 'transparent',
                      textDecoration: 'none',
                    }}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </a>
                </Tooltip>
              ))}
              <Tooltip title={itineraryTooltip} placement="bottom">
                <a
                  href="#"
                  className="nav-link-btn"
                  onClick={(e) => { e.preventDefault(); handleItineraryToggle(); }}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    transition: 'all 0.2s ease',
                    color: itineraryExpanded ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.45)',
                    background: itineraryExpanded ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Itinerary"
                >
                  <EnvironmentOutlined />
                </a>
              </Tooltip>
            </>
          )}

          {/* Separator */}
          {!isMobile && (
            <div style={{
              width: '1px',
              height: '24px',
              background: 'rgba(255, 255, 255, 0.08)',
              marginLeft: '4px',
              marginRight: '4px',
            }} />
          )}

          {/* User profile */}
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
            arrow
          >
            <div
              className="user-profile-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: isMobile ? '4px' : '4px 12px 4px 4px',
                cursor: 'pointer',
                borderRadius: '12px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: '40px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <Avatar
                size={32}
                src={user?.picture}
                icon={<UserOutlined />}
                style={{
                  backgroundColor: user?.picture ? 'transparent' : '#4f46e5',
                  boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.08)',
                }}
              />
              {!isMobile && (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
                  <span style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}>
                    {user?.name || 'User'}
                  </span>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </Header>

      {/* Mobile inline itinerary input bar */}
      {isMobile && itineraryExpanded && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          background: 'rgba(18, 18, 18, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          animation: 'itinerary-expand 0.2s ease-out',
        }}>
          <Input
            value={warehouseIds}
            onChange={(e) => setWarehouseIds(e.target.value)}
            placeholder="Warehouse IDs (e.g. 1, 5, 12)"
            size="small"
            onPressEnter={handleGenerateItinerary}
            disabled={generatingItinerary}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <Button
            type="primary"
            size="small"
            onClick={handleGenerateItinerary}
            loading={generatingItinerary}
            style={{ borderRadius: '6px', fontSize: '12px', flexShrink: 0 }}
          >
            Generate
          </Button>
        </div>
      )}

      {/* Itinerary Result Modal — output only */}
      <Modal
        title="Visit Itinerary"
        open={itineraryResultOpen}
        onCancel={handleResultClose}
        footer={null}
        width={isMobile ? '90vw' : 600}
        centered
      >
        {generatedItinerary && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Generated Itinerary (editable)
              </div>
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyItinerary}
                size="small"
              >
                Copy
              </Button>
            </div>
            <TextArea
              value={generatedItinerary}
              onChange={(e) => setGeneratedItinerary(e.target.value)}
              autoSize={{ minRows: 10, maxRows: 20 }}
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
};

export default MobileHeader;
