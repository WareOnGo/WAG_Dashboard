import React, { useState } from 'react';
import { Card, Button, Tag } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  UserOutlined,
  HomeOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import './WarehouseCard.css';

/**
 * WarehouseCard Component
 * 
 * A clean, mobile-optimized card component for displaying warehouse data
 */
const WarehouseCard = ({ 
  warehouse, 
  onEdit, 
  onDelete, 
  onViewDetails,
  onContextMenu 
}) => {
  const { isMobile } = useViewport();
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Get first image from photos string
  const getFirstImage = () => {
    if (!warehouse.photos) return null;
    const imageUrls = warehouse.photos.split(',').map(url => url.trim()).filter(url => url && url.length > 0);
    return imageUrls.length > 0 ? imageUrls[0] : null;
  };

  // Format space display
  const formatSpace = (space) => {
    if (!space) return '-';
    if (Array.isArray(space)) {
      return space.reduce((sum, val) => sum + val, 0).toLocaleString();
    }
    return space.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Format rate display
  const formatRate = (rate) => {
    if (!rate) return '-';
    const numericValue = typeof rate === 'string' 
      ? rate.replace(/[^\d.]/g, '') 
      : rate;
    return numericValue ? `₹${numericValue}/sq ft` : rate;
  };

  // Get warehouse status color
  const getStatusColor = () => {
    const availability = warehouse.availability?.toLowerCase();
    if (availability?.includes('available')) return 'green';
    if (availability?.includes('occupied')) return 'red';
    if (availability?.includes('partial')) return 'orange';
    return 'default';
  };

  // Handle card actions
  const handleAction = (action, event) => {
    event.stopPropagation();
    switch (action) {
      case 'edit':
        onEdit?.(warehouse);
        break;
      case 'delete':
        onDelete?.(warehouse);
        break;
      case 'view':
        onViewDetails?.(warehouse);
        break;
      default:
        break;
    }
  };

  // Handle card tap/click
  const handleCardClick = () => {
    if (isMobile) {
      setExpanded(!expanded);
    } else {
      onViewDetails?.(warehouse);
    }
  };

  // Handle context menu
  const handleContextMenu = (event) => {
    event.preventDefault();
    onContextMenu?.(warehouse, event);
  };

  const firstImage = getFirstImage();

  return (
    <Card
      className={`warehouse-card ${isMobile ? 'warehouse-card--mobile' : ''} ${expanded ? 'warehouse-card--expanded' : ''}`}
      onClick={handleCardClick}
      onContextMenu={handleContextMenu}
      hoverable
      data-testid="warehouse-card"
    >
      {/* Card Header */}
      <div className="warehouse-card__header">
        <div className="warehouse-card__id">
          <HomeOutlined className="warehouse-card__icon" />
          <span className="warehouse-card__id-text">#{warehouse.id}</span>
        </div>
        
        <div className="warehouse-card__status">
          <Tag color={getStatusColor()}>
            {warehouse.availability || 'Unknown'}
          </Tag>
          {warehouse.visibility && (
            <Tag color="blue">Visible</Tag>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="warehouse-card__content">
        {/* Image Section */}
        <div className="warehouse-card__image">
          {firstImage && firstImage.length > 0 && !imageError ? (
            <img
              src={firstImage}
              alt={`Warehouse ${warehouse.id}`}
              style={{
                width: '100%',
                height: '120px',
                objectFit: 'cover',
                borderRadius: '6px',
                backgroundColor: '#1f1f1f'
              }}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="warehouse-card__image-placeholder">
              <HomeOutlined className="warehouse-card__placeholder-icon" />
              <span className="warehouse-card__placeholder-text">No Image</span>
            </div>
          )}
        </div>

        {/* Primary Information */}
        <div className="warehouse-card__primary">
          <div className="warehouse-card__title">
            <h4>{warehouse.warehouseType}</h4>
            <span className="warehouse-card__owner-type">
              {warehouse.warehouseOwnerType}
            </span>
          </div>

          <div className="warehouse-card__location">
            <EnvironmentOutlined className="warehouse-card__icon" />
            <span>{warehouse.city}, {warehouse.state}</span>
            <Tag size="small" color="blue">{warehouse.zone}</Tag>
          </div>

          <div className="warehouse-card__contact">
            <UserOutlined className="warehouse-card__icon" />
            <span>{warehouse.contactPerson}</span>
            <PhoneOutlined className="warehouse-card__icon warehouse-card__icon--secondary" />
            <a 
              href={`tel:${warehouse.contactNumber}`}
              style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {warehouse.contactNumber}
            </a>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="warehouse-card__metrics">
          <div className="warehouse-card__metric">
            <span className="warehouse-card__metric-label">Total Space</span>
            <span className="warehouse-card__metric-value">
              {formatSpace(warehouse.totalSpaceSqft)} sq ft
            </span>
          </div>
          
          <div className="warehouse-card__metric">
            <span className="warehouse-card__metric-label">Rate</span>
            <span className="warehouse-card__metric-value">
              {formatRate(warehouse.ratePerSqft)}
            </span>
          </div>
          
          {warehouse.numberOfDocks && (
            <div className="warehouse-card__metric">
              <span className="warehouse-card__metric-label">Docks</span>
              <span className="warehouse-card__metric-value">
                {warehouse.numberOfDocks}
              </span>
            </div>
          )}
        </div>

        {/* Expandable Details */}
        {expanded && (
          <div className="warehouse-card__details">
            <div className="warehouse-card__detail-section">
              <h5>Address Details</h5>
              <p>{warehouse.address}</p>
              {warehouse.postalCode && <p>Postal Code: {warehouse.postalCode}</p>}
            </div>

            {warehouse.offeredSpaceSqft && (
              <div className="warehouse-card__detail-section">
                <h5>Space Information</h5>
                <p>Offered Space: {warehouse.offeredSpaceSqft}</p>
                {warehouse.clearHeightFt && <p>Clear Height: {warehouse.clearHeightFt} ft</p>}
              </div>
            )}

            {(warehouse.WarehouseData || warehouse.warehouseData) && (
              <div className="warehouse-card__detail-section">
                <h5>Additional Information</h5>
                {(warehouse.WarehouseData?.fireNocAvailable || warehouse.warehouseData?.fireNocAvailable) && (
                  <p>Fire NOC: Available</p>
                )}
                {(warehouse.WarehouseData?.landType || warehouse.warehouseData?.landType) && (
                  <p>Land Type: {warehouse.WarehouseData?.landType || warehouse.warehouseData?.landType}</p>
                )}
                {(warehouse.WarehouseData?.powerKva || warehouse.warehouseData?.powerKva) && (
                  <p>Power: {warehouse.WarehouseData?.powerKva || warehouse.warehouseData?.powerKva} KVA</p>
                )}
              </div>
            )}

            {warehouse.otherSpecifications && (
              <div className="warehouse-card__detail-section">
                <h5>Other Specifications</h5>
                <p>{warehouse.otherSpecifications}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="warehouse-card__actions">
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={(e) => handleAction('view', e)}
          className="warehouse-card__action-btn"
        >
          {isMobile ? '' : 'View'}
        </Button>
        
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={(e) => handleAction('edit', e)}
          className="warehouse-card__action-btn"
        >
          {isMobile ? '' : 'Edit'}
        </Button>
        
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={(e) => handleAction('delete', e)}
          className="warehouse-card__action-btn"
        >
          {isMobile ? '' : 'Delete'}
        </Button>

        {isMobile && (
          <Button
            type="text"
            icon={<MoreOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="warehouse-card__action-btn warehouse-card__expand-btn"
          >
            {expanded ? 'Less' : 'More'}
          </Button>
        )}
      </div>

      {/* Mobile tap hint */}
      {isMobile && !expanded && (
        <div className="warehouse-card__tap-hint">
          Tap to expand details
        </div>
      )}
    </Card>
  );
};

export default WarehouseCard;