import React, { useState, useEffect } from 'react';
import { Layout, Typography, Button, Dropdown, Avatar, Tooltip, Modal, Input, Checkbox, message } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  MenuOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  CopyOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';
import { useAuth } from '../contexts/AuthContext';
import { useMobileTools } from '../contexts/MobileToolsContext';
import { warehouseService } from '../services/warehouseService';
import { generateStandardPpt, generateDetailedPpt, generatePptV2, generateGodamwalePpt, generateTciPpt } from '../services/pptService';
import PptConfigModal from './PptConfigModal';

const { Header } = Layout;
const { Text } = Typography;
const { TextArea } = Input;

// Build the formatted itinerary text from the resolved warehouses.
// When hideOwner is true, the contact person name and phone number are omitted.
// When hideRent is true, the rate line is omitted.
const buildItineraryText = (foundWarehouses, contactMap, hideOwner, hideRent) => {
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

    // Use unmasked phone number if available, fall back to masked
    const phone = contactMap[wh.id] || wh.contactNumber || 'N/A';

    // Format address
    const addressParts = [
      wh.address,
      wh.city,
      wh.state,
      wh.postalCode
    ].filter(part => part); // Remove empty/null values
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';

    // Header line — drop owner name/number when the user opts to hide owner details.
    const header = hideOwner
      ? `${index + 1}. WH-${wh.id}`
      : `${index + 1}. WH-${wh.id} - ${wh.contactPerson || 'N/A'} (${phone})`;

    const lines = [
      header,
      `   Address: ${fullAddress}`,
      `   Total Space: ${totalSpace} sq ft`,
      `   Docks: ${wh.numberOfDocks || 0}`,
      `  Compliances: ${compliances || 'N/A'}`,
      `  Other Specs: ${otherSpecifications || 'N/A'}`,
      ...(hideRent ? [] : [`  Rate: ${rate ?? ''}`]),
      `   Location: ${wh.googleLocation || 'No location available'}`,
    ];

    return lines.join('\n');
  });

  return itineraryLines.join('\n\n');
};

const MobileHeader = ({ onMenuToggle }) => {
  const { isMobile } = useViewport();
  const { user, logout } = useAuth();
  // PPT/Itinerary open-state is shared (via context) so the mobile nav drawer can
  // open these tools while this header renders them. Aliased to the previous names.
  const {
    pptOpen: pptExpanded, setPptOpen: setPptExpanded,
    itineraryOpen: itineraryExpanded, setItineraryOpen: setItineraryExpanded,
  } = useMobileTools();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [itineraryResultOpen, setItineraryResultOpen] = useState(false);
  const [warehouseIds, setWarehouseIds] = useState('');
  const [generatedItinerary, setGeneratedItinerary] = useState('');
  const [warehouses, setWarehouses] = useState(null);
  const [generatingItinerary, setGeneratingItinerary] = useState(false);
  // Resolved data backing the current itinerary result, so it can be re-rendered
  // (e.g. when toggling "hide owner detail") without re-fetching.
  const [itineraryWarehouses, setItineraryWarehouses] = useState([]);
  const [itineraryContactMap, setItineraryContactMap] = useState({});
  const [hideOwnerDetail, setHideOwnerDetail] = useState(false);
  const [hideRent, setHideRent] = useState(false);

  // PPT generator state
  const [pptWarehouseIds, setPptWarehouseIds] = useState('');
  const [pptModalOpen, setPptModalOpen] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);

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

  // Toggle the inline itinerary input in the navbar (used by the desktop nav link)
  const handleItineraryToggle = () => {
    setItineraryExpanded(prev => !prev);
  };

  // Lazy-load warehouse data the first time the itinerary tool opens, regardless of
  // whether it was opened from the desktop nav or the mobile drawer.
  useEffect(() => {
    if (itineraryExpanded && !warehouses) {
      warehouseService.getAll()
        .then(data => setWarehouses(Array.isArray(data) ? data : []))
        .catch(error => {
          console.error('Failed to fetch warehouses:', error);
          message.error('Failed to load warehouse data');
        });
    }
  }, [itineraryExpanded, warehouses]);

  // Generate itinerary from comma-separated IDs
  const handleGenerateItinerary = async () => {
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

      // Fetch unmasked phone numbers for all warehouses in parallel
      const contactResults = await Promise.allSettled(
        foundWarehouses.map(wh => warehouseService.getContactNumber(wh.id))
      );
      const contactMap = {};
      foundWarehouses.forEach((wh, i) => {
        if (contactResults[i].status === 'fulfilled') {
          contactMap[wh.id] = contactResults[i].value.contactNumber;
        }
      });

      // Reset the toggle for each fresh generation, then build the formatted text.
      // Keep the resolved data around so the modal can re-render on toggle.
      setItineraryWarehouses(foundWarehouses);
      setItineraryContactMap(contactMap);
      setHideOwnerDetail(false);
      setHideRent(false);

      const itinerary = buildItineraryText(foundWarehouses, contactMap, false, false);
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

  // Re-render the itinerary text when the user toggles field visibility.
  // Note: this regenerates from the resolved data, so any manual edits are reset.
  const handleToggleHideOwner = (checked) => {
    setHideOwnerDetail(checked);
    setGeneratedItinerary(buildItineraryText(itineraryWarehouses, itineraryContactMap, checked, hideRent));
  };

  const handleToggleHideRent = (checked) => {
    setHideRent(checked);
    setGeneratedItinerary(buildItineraryText(itineraryWarehouses, itineraryContactMap, hideOwnerDetail, checked));
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
    {
      key: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: <DashboardOutlined />,
      tooltip: 'Back to dashboard',
    },
    ...((user?.isAdmin || user?.isReviewer)
      ? [{
          key: 'review',
          label: 'Review Queue',
          href: '/review',
          icon: <SafetyCertificateOutlined />,
          tooltip: 'Review staged warehouse submissions',
        }]
      : []),
  ];

  const pptTooltip = 'Generate warehouse presentation (PPT)';
  const itineraryTooltip = 'Generate copy-pastable itinerary details for on-ground teams';

  // Handle PPT inline toggle
  const handlePptToggle = () => {
    setPptExpanded(!pptExpanded);
  };

  // Open config modal when user submits IDs
  const handlePptSubmitIds = async () => {
    if (!pptWarehouseIds.trim()) {
      message.warning('Please enter warehouse IDs');
      return;
    }
    // Lazy-load warehouse data if not already loaded (shared with itinerary)
    if (!warehouses) {
      try {
        const data = await warehouseService.getAll();
        setWarehouses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch warehouses:', error);
        message.error('Failed to load warehouse data');
        return;
      }
    }
    setPptModalOpen(true);
  };

  // Called from PptConfigModal when user clicks Generate
  const handlePptGenerate = async ({ pptType, customDetails, selectedImages }) => {
    setGeneratingPpt(true);
    try {
      const ids = pptWarehouseIds.trim();
      if (pptType === 'detailed') {
        await generateDetailedPpt({ ids, selectedImages, customDetails });
      } else if (pptType === 'v2') {
        await generatePptV2({ ids, selectedImages, customDetails });
      } else if (pptType === 'godamwale') {
        await generateGodamwalePpt({ ids, selectedImages, customDetails });
      } else if (pptType === 'tci') {
        await generateTciPpt({ ids, selectedImages, customDetails });
      } else {
        await generateStandardPpt({
          ids,
          selectedImages,
          includeLocation: pptType === 'standard-with-location',
          customDetails,
        });
      }
      message.success('Presentation downloaded successfully!');
      setPptModalOpen(false);
      setPptWarehouseIds('');
      setPptExpanded(false);
    } catch (error) {
      console.error('PPT generation error:', error);
      message.error(error.message || 'Failed to generate presentation');
    } finally {
      setGeneratingPpt(false);
    }
  };

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 'var(--z-sticky, 1000)', width: '100%' }}>
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
            href="/dashboard"
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
            <nav style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '28px' }}>
              {/* PPT Generator inline */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={pptTooltip} placement="bottom">
                  <a
                    href="#"
                    className="nav-link-btn"
                    onClick={(e) => { e.preventDefault(); handlePptToggle(); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: pptExpanded ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.5)',
                      transition: 'color 0.15s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '13px', display: 'flex' }}><FileTextOutlined /></span>
                    PPT Generator
                  </a>
                </Tooltip>
                {pptExpanded && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginLeft: '10px',
                    animation: 'itinerary-expand 0.2s ease-out',
                  }}>
                    <Input
                      value={pptWarehouseIds}
                      onChange={(e) => setPptWarehouseIds(e.target.value)}
                      placeholder="Warehouse IDs (e.g. 1, 5, 12)"
                      size="small"
                      onPressEnter={handlePptSubmitIds}
                      style={{
                        width: '280px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                    <Button
                      type="primary"
                      size="small"
                      onClick={handlePptSubmitIds}
                      style={{ borderRadius: '6px', fontSize: '12px' }}
                    >
                      Submit
                    </Button>
                  </div>
                )}
              </div>

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
              <div style={{ display: 'flex', alignItems: 'center' }}>
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
                    gap: '8px',
                    marginLeft: '10px',
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
                        width: '280px',
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
          {/* Mobile tool/nav icons intentionally removed — they now live in the
              hamburger drawer (MobileNavigation) as labeled rows, so the mobile
              header stays as: menu + brand + avatar. */}

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

          {/* User profile — on mobile the avatar opens the nav drawer (which holds
              the profile + Sign Out); on desktop it opens the Sign Out dropdown. */}
          <Dropdown
            menu={{ items: userMenuItems }}
            trigger={['click']}
            placement="bottomRight"
            arrow
            disabled={isMobile}
          >
            <div
              className="user-profile-btn"
              onClick={isMobile ? onMenuToggle : undefined}
              aria-label={isMobile ? 'Open menu' : undefined}
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

      {/* Mobile inline PPT input bar */}
      {isMobile && pptExpanded && (
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
            value={pptWarehouseIds}
            onChange={(e) => setPptWarehouseIds(e.target.value)}
            placeholder="Warehouse IDs for PPT (e.g. 1, 5, 12)"
            size="small"
            onPressEnter={handlePptSubmitIds}
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
            onClick={handlePptSubmitIds}
            style={{ borderRadius: '6px', fontSize: '12px', flexShrink: 0 }}
          >
            Submit
          </Button>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setPptExpanded(false)}
            aria-label="Close PPT generator"
            style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}
          />
        </div>
      )}

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
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setItineraryExpanded(false)}
            aria-label="Close itinerary"
            style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}
          />
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
              gap: '8px',
              marginBottom: '10px'
            }}>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Generated Itinerary (editable)
              </div>
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyItinerary}
                size="small"
                style={{ flexShrink: 0 }}
              >
                Copy
              </Button>
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: isMobile ? '20px' : '16px',
              rowGap: '8px',
              marginBottom: '10px'
            }}>
              <Checkbox
                checked={hideOwnerDetail}
                onChange={(e) => handleToggleHideOwner(e.target.checked)}
                style={isMobile ? { padding: '4px 0' } : undefined}
              >
                Hide owner detail
              </Checkbox>
              <Checkbox
                checked={hideRent}
                onChange={(e) => handleToggleHideRent(e.target.checked)}
                style={isMobile ? { padding: '4px 0' } : undefined}
              >
                Hide rent
              </Checkbox>
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

      {/* PPT Config Modal */}
      <PptConfigModal
        open={pptModalOpen}
        warehouseIds={pptWarehouseIds}
        allWarehouses={warehouses}
        onCancel={() => setPptModalOpen(false)}
        onGenerate={handlePptGenerate}
        generating={generatingPpt}
      />
    </div>
  );
};

export default MobileHeader;
