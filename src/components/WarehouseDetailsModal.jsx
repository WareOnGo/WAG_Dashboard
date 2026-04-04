import React, { useState } from 'react';
import { Row, Col, Typography, Tag, Image, Collapse, Space, Button } from 'antd';
import { 
  EnvironmentOutlined, 
  PhoneOutlined, 
  UserOutlined,
  HomeOutlined,
  ExpandOutlined,
  DollarOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  UndoOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import ResponsiveModal from './ResponsiveModal';
import RedactedPhone from './RedactedPhone';
import { useViewport } from '../hooks/useViewport';
import { downloadAllImages, ERROR_MESSAGES, isMobileBrowser } from '../utils/imageDownloadUtils';
import { showSuccessMessage, showErrorNotification } from '../utils/errorHandler';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import './ResponsiveModal.css';

const { Title, Text } = Typography;
const { Panel } = Collapse;

/**
 * WarehouseDetailsModal Component
 * 
 * Mobile-optimized modal for displaying detailed warehouse information.
 * Organizes information into collapsible sections for better mobile navigation.
 * Implements touch-friendly interactions and responsive layout.
 */
const WarehouseDetailsModal = ({
  visible = false,
  onClose,
  warehouse = null
}) => {
  const { isMobile } = useViewport();
  const [isDownloading, setIsDownloading] = useState(false);

  if (!warehouse) return null;

  // Download handler function
  const handleDownloadAllImages = async () => {
    const imageUrls = getImageUrls();
    
    if (imageUrls.length === 0) {
      showErrorNotification(
        { message: ERROR_MESSAGES.NO_IMAGES },
        { title: 'Download Failed', duration: 4 }
      );
      return;
    }

    // Show mobile-specific info message if on mobile with many images
    const isMobile = isMobileBrowser();
    if (isMobile && imageUrls.length > 3) {
      showSuccessMessage('info', {
        details: ERROR_MESSAGES.MOBILE_FALLBACK,
        duration: 6
      });
    }

    setIsDownloading(true);

    try {
      const results = await downloadAllImages(imageUrls, warehouse.id);
      
      // Reset state
      setIsDownloading(false);
      
      // Display appropriate notification based on results
      if (results.successful === results.total) {
        // All downloads successful
        const message = results.usedFallback
          ? `Successfully processed ${results.successful} image${results.successful > 1 ? 's' : ''}. Some images opened in new tabs.`
          : `Successfully downloaded ${results.successful} image${results.successful > 1 ? 's' : ''}`;
        
        showSuccessMessage('download', {
          details: message,
          duration: 4
        });
      } else if (results.successful > 0) {
        // Partial success
        const hasCorsError = results.errors.some(err => 
          err.error.toLowerCase().includes('cors')
        );
        
        let description = ERROR_MESSAGES.PARTIAL_FAILURE(results.successful, results.total, results.failed);
        
        if (results.usedFallback) {
          description += '\n\nSome images were opened in new tabs due to mobile browser limitations.';
        }
        
        if (hasCorsError) {
          description += `\n\n${ERROR_MESSAGES.CORS_ERROR}`;
        }
        
        showErrorNotification(
          { message: description },
          { 
            title: 'Partial Download Success', 
            duration: 8,
            showDetails: true
          }
        );
      } else {
        // Complete failure
        const hasCorsError = results.errors.some(err => 
          err.error.toLowerCase().includes('cors')
        );
        const hasNetworkError = results.errors.some(err => 
          err.error.toLowerCase().includes('network')
        );
        
        let errorMessage = ERROR_MESSAGES.COMPLETE_FAILURE;
        if (hasCorsError) {
          errorMessage = ERROR_MESSAGES.CORS_ERROR;
        } else if (hasNetworkError) {
          errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
        }
        
        showErrorNotification(
          { message: errorMessage },
          { 
            title: 'Download Failed', 
            duration: 8,
            showDetails: true
          }
        );
      }
    } catch (error) {
      setIsDownloading(false);
      
      // Handle unexpected errors
      showErrorNotification(
        { message: error.message || ERROR_MESSAGES.COMPLETE_FAILURE },
        { 
          title: 'Download Error', 
          duration: 8
        }
      );
    }
  };

  // Helper function to render field with label
  const renderField = (label, value, icon = null) => {
    if (!value || value === '-' || value === '') return null;
    
    return (
      <div style={{ marginBottom: isMobile ? '16px' : '12px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '4px',
          gap: '6px'
        }}>
          {icon}
          <Text style={{ 
            color: 'rgba(255, 255, 255, 0.65)', 
            fontSize: '12px',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {label}
          </Text>
        </div>
        <div style={{ 
          color: '#fff', 
          fontSize: isMobile ? '15px' : '14px', 
          fontWeight: 500,
          lineHeight: 1.4
        }}>
          {value}
        </div>
      </div>
    );
  };

  // Helper function to format space values
  const formatSpace = (space) => {
    if (Array.isArray(space)) {
      return `[${space.join(', ')}] sq ft`;
    }
    return space ? `${space.toLocaleString()} sq ft` : '-';
  };

  // Helper function to format boolean values
  const formatBoolean = (value) => {
    if (value === true || value === 'true' || value === 1) {
      return <Tag color="green">Yes</Tag>;
    }
    if (value === false || value === 'false' || value === 0) {
      return <Tag color="red">No</Tag>;
    }
    return '-';
  };

  // Basic Information Section
  const basicInfoContent = (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12}>
        {renderField('Warehouse Owner Type', warehouse.warehouseOwnerType, <UserOutlined />)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Warehouse Type', warehouse.warehouseType, <HomeOutlined />)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Zone', warehouse.zone, <EnvironmentOutlined />)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Visibility', formatBoolean(warehouse.visibility))}
      </Col>
    </Row>
  );

  // Address Information Section
  const addressInfoContent = (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        {renderField('Address', warehouse.address, <EnvironmentOutlined />)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('City', warehouse.city)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('State', warehouse.state)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Postal Code', warehouse.postalCode)}
      </Col>
      <Col xs={24}>
        {warehouse.googleLocation && renderField(
          'Google Location', 
          <a 
            href={warehouse.googleLocation} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              color: 'var(--accent-primary)',
              textDecoration: 'underline'
            }}
          >
            View on Google Maps
          </a>
        )}
      </Col>
    </Row>
  );

  // Contact Information Section
  const contactInfoContent = (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12}>
        {renderField('Contact Person', warehouse.contactPerson, <UserOutlined />)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Contact Number', (
          <RedactedPhone warehouseId={warehouse.id} />
        ), <PhoneOutlined />)}
      </Col>
    </Row>
  );

  // Warehouse Details Section
  const warehouseDetailsContent = (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={8}>
        {renderField('Total Space', formatSpace(warehouse.totalSpaceSqft), <ExpandOutlined />)}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Offered Space', warehouse.offeredSpaceSqft ? `${warehouse.offeredSpaceSqft} sq ft` : '-')}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Rate per Sq Ft', warehouse.ratePerSqft, <DollarOutlined />)}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Number of Docks', warehouse.numberOfDocks)}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Clear Height', warehouse.clearHeightFt ? `${warehouse.clearHeightFt} ft` : '-')}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Availability', warehouse.availability)}
      </Col>
      <Col xs={24} sm={8}>
        {renderField('Is Broker', formatBoolean(warehouse.isBroker))}
      </Col>
      <Col xs={24}>
        {renderField('Other Specifications', warehouse.otherSpecifications)}
      </Col>
    </Row>
  );

  // Location Data Section
  const locationDataContent = (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12}>
        {renderField('Latitude', warehouse.latitude)}
      </Col>
      <Col xs={24} sm={12}>
        {renderField('Longitude', warehouse.longitude)}
      </Col>
    </Row>
  );

  // Images Section with enhanced mobile viewing
  const getImageUrls = () => {
    const media = getMediaFromWarehouse(warehouse);
    return media.images || [];
  };

  const imageUrls = getImageUrls();
  
  const downloadButton = imageUrls.length > 0 && (
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      onClick={handleDownloadAllImages}
      loading={isDownloading}
      disabled={imageUrls.length === 0}
      size={isMobile ? 'large' : 'middle'}
      style={{
        minHeight: isMobile ? '44px' : 'auto',
        minWidth: isMobile ? '44px' : 'auto',
        marginBottom: isMobile ? '20px' : '16px',
        marginTop: isMobile ? '8px' : '0',
        width: isMobile ? '100%' : 'auto',
        padding: isMobile ? '8px 16px' : undefined,
        fontSize: isMobile ? '16px' : '14px',
        fontWeight: 500,
        touchAction: 'manipulation', // Optimize for touch
        WebkitTapHighlightColor: 'transparent' // Remove tap highlight on mobile
      }}
    >
      {isDownloading ? 'Downloading...' : 'Download All Images'}
    </Button>
  );
  
  const imagesContent = imageUrls.length > 0 ? (
    <div style={{ 
      marginTop: isMobile ? '8px' : '0',
      paddingTop: isMobile ? '8px' : '0'
    }}>
      {downloadButton}
      <Row gutter={[16, 16]}>
      <Image.PreviewGroup>
        {imageUrls.map((image, index) => (
          <Col xs={12} sm={8} md={6} key={index}>
            <Image
              src={image}
              alt={`Warehouse ${warehouse.id} - Image ${index + 1}`}
              style={{
                width: '100%',
                height: isMobile ? '120px' : '100px',
                objectFit: 'cover',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid var(--border-primary)'
              }}
              preview={{
                mask: 'Preview',
                maskClassName: 'warehouse-image-preview',
                // Enhanced preview for mobile with touch support
                toolbarRender: (
                  _,
                  {
                    actions: { onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset }
                  }
                ) => (
                  <Space size={12} className="toolbar-wrapper">
                    <Button
                      type="text"
                      icon={<ZoomInOutlined />}
                      onClick={onZoomIn}
                      style={{ color: '#fff', minHeight: '44px', minWidth: '44px' }}
                      title="Zoom In"
                    />
                    <Button
                      type="text"
                      icon={<ZoomOutOutlined />}
                      onClick={onZoomOut}
                      style={{ color: '#fff', minHeight: '44px', minWidth: '44px' }}
                      title="Zoom Out"
                    />
                    <Button
                      type="text"
                      icon={<RotateLeftOutlined />}
                      onClick={onRotateLeft}
                      style={{ color: '#fff', minHeight: '44px', minWidth: '44px' }}
                      title="Rotate Left"
                    />
                    <Button
                      type="text"
                      icon={<RotateRightOutlined />}
                      onClick={onRotateRight}
                      style={{ color: '#fff', minHeight: '44px', minWidth: '44px' }}
                      title="Rotate Right"
                    />
                    <Button
                      type="text"
                      icon={<UndoOutlined />}
                      onClick={onReset}
                      style={{ color: '#fff', minHeight: '44px', minWidth: '44px' }}
                      title="Reset"
                    />
                  </Space>
                )
              }}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
            />
          </Col>
        ))}
      </Image.PreviewGroup>
    </Row>
    </div>
  ) : (
    <Text style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
      No images available
    </Text>
  );

  // Mobile layout with collapsible sections
  const mobileContent = (
    <Collapse 
      defaultActiveKey={['basic', 'address']}
      ghost
      style={{ 
        background: 'transparent',
        border: 'none'
      }}
    >
      <Panel 
        header={
          <Text style={{ 
            color: 'var(--text-primary)', 
            fontSize: '16px', 
            fontWeight: 600 
          }}>
            Basic Information
          </Text>
        } 
        key="basic"
        style={{ 
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-primary)'
        }}
      >
        {basicInfoContent}
      </Panel>
      
      <Panel 
        header={
          <Text style={{ 
            color: 'var(--text-primary)', 
            fontSize: '16px', 
            fontWeight: 600 
          }}>
            Address Information
          </Text>
        } 
        key="address"
        style={{ 
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-primary)'
        }}
      >
        {addressInfoContent}
      </Panel>
      
      <Panel 
        header={
          <Text style={{ 
            color: 'var(--text-primary)', 
            fontSize: '16px', 
            fontWeight: 600 
          }}>
            Contact Information
          </Text>
        } 
        key="contact"
        style={{ 
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-primary)'
        }}
      >
        {contactInfoContent}
      </Panel>
      
      <Panel 
        header={
          <Text style={{ 
            color: 'var(--text-primary)', 
            fontSize: '16px', 
            fontWeight: 600 
          }}>
            Warehouse Details
          </Text>
        } 
        key="details"
        style={{ 
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-primary)'
        }}
      >
        {warehouseDetailsContent}
      </Panel>
      
      <Panel 
        header={
          <Text style={{ 
            color: 'var(--text-primary)', 
            fontSize: '16px', 
            fontWeight: 600 
          }}>
            Location Data
          </Text>
        } 
        key="location"
        style={{ 
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--border-primary)'
        }}
      >
        {locationDataContent}
      </Panel>
      
      {imageUrls.length > 0 && (
        <Panel 
          header={
            <Text style={{ 
              color: 'var(--text-primary)', 
              fontSize: '16px', 
              fontWeight: 600 
            }}>
              Images
            </Text>
          } 
          key="images"
          style={{ 
            background: 'transparent',
            border: 'none'
          }}
        >
          {imagesContent}
        </Panel>
      )}
    </Collapse>
  );

  // Desktop layout with sections
  const desktopContent = (
    <div>
      {/* Basic Information */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
          Basic Information
        </Title>
        {basicInfoContent}
      </div>

      {/* Address Information */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
          Address Information
        </Title>
        {addressInfoContent}
      </div>

      {/* Contact Information */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
          Contact Information
        </Title>
        {contactInfoContent}
      </div>

      {/* Warehouse Details */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
          Warehouse Details
        </Title>
        {warehouseDetailsContent}
      </div>

      {/* Location Data */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
          Location Data
        </Title>
        {locationDataContent}
      </div>

      {/* Images */}
      {imageUrls.length > 0 && (
        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '16px' }}>
            Images
          </Title>
          {imagesContent}
        </div>
      )}
    </div>
  );

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      title={`Warehouse Details - #${warehouse.id}`}
      maxWidth="900px"
      className="warehouse-details-modal"
    >
      {isMobile ? mobileContent : desktopContent}
    </ResponsiveModal>
  );
};

export default WarehouseDetailsModal;