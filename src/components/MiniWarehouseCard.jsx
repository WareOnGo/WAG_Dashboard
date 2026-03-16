import React, { useState } from 'react';
import { Button, Tag } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  EnvironmentOutlined,
  HomeOutlined
} from '@ant-design/icons';
import './MiniWarehouseCard.css';

/**
 * MiniWarehouseCard Component
 * Compact card for map popups
 */
const MiniWarehouseCard = ({ 
  warehouse, 
  onEdit, 
  onDelete, 
  onViewDetails
}) => {
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

  const firstImage = getFirstImage();

  return (
    <div className="mini-warehouse-card">
      {/* Header */}
      <div className="mini-warehouse-card__header">
        <div className="mini-warehouse-card__id">
          <HomeOutlined className="mini-warehouse-card__icon" />
          <span>#{warehouse.id}</span>
        </div>
        <div className="mini-warehouse-card__status">
          <Tag color={getStatusColor()} size="small">
            {warehouse.availability || 'Unknown'}
          </Tag>
        </div>
      </div>

      {/* Image */}
      {firstImage && !imageError ? (
        <div className="mini-warehouse-card__image">
          <img
            src={firstImage}
            alt={`Warehouse ${warehouse.id}`}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="mini-warehouse-card__image">
          <div className="mini-warehouse-card__image-placeholder">
            <HomeOutlined className="mini-warehouse-card__placeholder-icon" />
            <span className="mini-warehouse-card__placeholder-text">No Image</span>
          </div>
        </div>
      )}

      {/* Title */}
      <div className="mini-warehouse-card__title">
        {warehouse.warehouseType}
      </div>
      <span className="mini-warehouse-card__owner-type">
        {warehouse.warehouseOwnerType}
      </span>

      {/* Location */}
      <div className="mini-warehouse-card__location">
        <EnvironmentOutlined className="mini-warehouse-card__icon" />
        <span>{warehouse.city}, {warehouse.state}</span>
        <Tag size="small" color="blue">{warehouse.zone}</Tag>
      </div>

      {/* Metrics */}
      <div className="mini-warehouse-card__metrics">
        <div className="mini-warehouse-card__metric">
          <span className="mini-warehouse-card__metric-label">Total Space</span>
          <span className="mini-warehouse-card__metric-value">
            {formatSpace(warehouse.totalSpaceSqft)} sq ft
          </span>
        </div>
        
        <div className="mini-warehouse-card__metric">
          <span className="mini-warehouse-card__metric-label">Rate</span>
          <span className="mini-warehouse-card__metric-value">
            {formatRate(warehouse.ratePerSqft)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="mini-warehouse-card__actions">
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(warehouse);
          }}
          className="mini-warehouse-card__action-btn"
        >
          View
        </Button>
        
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(warehouse);
          }}
          className="mini-warehouse-card__action-btn"
        >
          Edit
        </Button>
        
        <Button
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(warehouse);
          }}
          className="mini-warehouse-card__action-btn"
        >
          Delete
        </Button>
      </div>
    </div>
  );
};

export default MiniWarehouseCard;
