import React from 'react';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  UserOutlined
} from '@ant-design/icons';
import './SimpleWarehouseCard.css';

/**
 * Simple Warehouse Card - Matching site's design system
 */
const SimpleWarehouseCard = ({ 
  warehouse, 
  onEdit, 
  onDelete, 
  onViewDetails 
}) => {
  // Get first image
  const getFirstImage = () => {
    if (!warehouse.photos) return null;
    const imageUrls = warehouse.photos.split(',').map(url => url.trim()).filter(url => url && url.length > 0);
    return imageUrls.length > 0 ? imageUrls[0] : null;
  };

  // Get visibility status and class
  const getVisibilityStatus = () => {
    // Check if warehouse has explicit visibility property
    if (warehouse.visibility !== undefined) {
      // Handle different types of visibility values
      if (typeof warehouse.visibility === 'string') {
        return warehouse.visibility.toLowerCase();
      } else if (typeof warehouse.visibility === 'boolean') {
        return warehouse.visibility ? 'visible' : 'hidden';
      } else {
        // Convert to string and then lowercase
        return String(warehouse.visibility).toLowerCase();
      }
    }
    
    // Check if warehouse has a hidden flag
    if (warehouse.hidden === true || warehouse.isHidden === true) {
      return 'hidden';
    }
    
    // Check if warehouse is inactive or disabled
    if (warehouse.active === false || warehouse.enabled === false || warehouse.isActive === false) {
      return 'hidden';
    }
    
    // Check status field for hidden indicators
    if (warehouse.status) {
      const status = warehouse.status.toLowerCase();
      if (status.includes('hidden') || status.includes('inactive') || status.includes('disabled')) {
        return 'hidden';
      }
    }
    
    // For debugging - let's also check if there's a pattern in the data
    // You can remove this console.log once we figure out the right property
    console.log('Warehouse data for visibility check:', {
      id: warehouse.id,
      visibility: warehouse.visibility,
      visibilityType: typeof warehouse.visibility,
      hidden: warehouse.hidden,
      isHidden: warehouse.isHidden,
      active: warehouse.active,
      enabled: warehouse.enabled,
      isActive: warehouse.isActive,
      status: warehouse.status,
      availability: warehouse.availability
    });
    
    // Default to visible
    return 'visible';
  };

  const getVisibilityClass = () => {
    const visibility = getVisibilityStatus().toLowerCase();
    if (visibility === 'visible') {
      return 'simple-warehouse-card__status--visible';
    }
    return 'simple-warehouse-card__status--hidden';
  };

  // Format space
  const formatSpace = (space) => {
    if (!space) return '-';
    if (Array.isArray(space)) {
      return space.reduce((sum, val) => sum + val, 0).toLocaleString();
    }
    return space.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // Format rate
  const formatRate = (rate) => {
    if (!rate) return '-';
    const numericValue = typeof rate === 'string' 
      ? rate.replace(/[^\d.]/g, '') 
      : rate;
    return numericValue ? `₹${numericValue}/sq ft` : rate;
  };

  const firstImage = getFirstImage();

  return (
    <div className="simple-warehouse-card">
      {/* Header */}
      <div className="simple-warehouse-card__header">
        <div className="simple-warehouse-card__id">
          <span>#{warehouse.id}</span>
        </div>
        <div className={`simple-warehouse-card__status ${getVisibilityClass()}`}>
          {getVisibilityStatus()}
        </div>
      </div>

      {/* Image */}
      {firstImage ? (
        <img 
          src={firstImage} 
          alt={`Warehouse ${warehouse.id}`}
          className="simple-warehouse-card__image"
          loading="lazy"
        />
      ) : (
        <div className="simple-warehouse-card__image-placeholder">
          <span className="simple-warehouse-card__placeholder-text">No Image</span>
        </div>
      )}

      {/* Content */}
      <div className="simple-warehouse-card__content">
        <div className="simple-warehouse-card__top-content">
          <h4 className="simple-warehouse-card__title">{warehouse.warehouseType}</h4>
          {warehouse.warehouseOwnerType && (
            <div className="simple-warehouse-card__owner-type">{warehouse.warehouseOwnerType}</div>
          )}
          
          <div className="simple-warehouse-card__location">
            <EnvironmentOutlined className="simple-warehouse-card__icon" />
            <span>{warehouse.city}, {warehouse.state}</span>
            <span className="simple-warehouse-card__zone-tag">{warehouse.zone}</span>
          </div>
          
          <div className="simple-warehouse-card__contact">
            <UserOutlined className="simple-warehouse-card__icon" />
            <span>{warehouse.contactPerson}</span>
            <PhoneOutlined className="simple-warehouse-card__icon simple-warehouse-card__icon--secondary" />
            <a 
              href={`tel:${warehouse.contactNumber}`}
              style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
            >
              {warehouse.contactNumber}
            </a>
          </div>
        </div>

        <div className="simple-warehouse-card__bottom-content">
          {/* Metrics */}
          <div className="simple-warehouse-card__metrics">
            <div className="simple-warehouse-card__metric">
              <span className="simple-warehouse-card__metric-label">Total Space</span>
              <span className="simple-warehouse-card__metric-value">
                {formatSpace(warehouse.totalSpaceSqft)} sq ft
              </span>
            </div>
            
            <div className="simple-warehouse-card__metric">
              <span className="simple-warehouse-card__metric-label">Rate</span>
              <span className="simple-warehouse-card__metric-value">
                {formatRate(warehouse.ratePerSqft)}
              </span>
            </div>
            
            {warehouse.numberOfDocks && (
              <div className="simple-warehouse-card__metric">
                <span className="simple-warehouse-card__metric-label">Docks</span>
                <span className="simple-warehouse-card__metric-value">
                  {warehouse.numberOfDocks}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="simple-warehouse-card__actions">
            <button 
              className="simple-warehouse-card__action-btn" 
              onClick={(e) => { e.stopPropagation(); onViewDetails?.(warehouse); }}
            >
              <EyeOutlined /> View
            </button>
            <button 
              className="simple-warehouse-card__action-btn" 
              onClick={(e) => { e.stopPropagation(); onEdit?.(warehouse); }}
            >
              <EditOutlined /> Edit
            </button>
            <button 
              className="simple-warehouse-card__action-btn simple-warehouse-card__action-btn--danger" 
              onClick={(e) => { e.stopPropagation(); onDelete?.(warehouse); }}
            >
              <DeleteOutlined /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimpleWarehouseCard;