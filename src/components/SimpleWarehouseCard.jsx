import React from 'react';
import { App } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  UserOutlined
} from '@ant-design/icons';
import RedactedPhone from './RedactedPhone';
import ImageWithFallback from './ImageWithFallback';
import { getMediaFromWarehouse, imageVariant } from '../utils/mediaUtils';
import { getMicroMarketDisplayNames } from '../utils/microMarketNames';
import { useAuth } from '../contexts/AuthContext';
import './SimpleWarehouseCard.css';

/**
 * Simple Warehouse Card - Matching site's design system
 */
const SimpleWarehouseCard = ({
  warehouse,
  onEdit,
  onDelete,
  onViewDetails,
  onToggleVisibility,
  // Optional overrides (used by the review queue; dashboard leaves these undefined)
  idLabel,        // overrides the "#id" header text
  statusContent,  // overrides the visibility status chip
  actions,        // overrides the default View/Edit/Delete action row
  metaInfo,       // optional provenance strip rendered above the actions
}) => {
  const { user } = useAuth();
  const { message } = App.useApp();
  const isAdmin = !!user?.isAdmin;

  // Get first image from media (with fallback to photos CSV)
  const getFirstImage = () => {
    const media = getMediaFromWarehouse(warehouse);
    return media.images?.[0] || null;
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
  const microMarkets = getMicroMarketDisplayNames(warehouse.micromarket);

  const handleCopyId = async (event) => {
    event.stopPropagation();

    try {
      const id = String(warehouse.id);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        const textarea = document.createElement('textarea');
        const focusedElement = document.activeElement;
        textarea.value = id;
        textarea.readOnly = true;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand('copy')) throw new Error('Copy failed');
        } finally {
          textarea.remove();
          focusedElement?.focus({ preventScroll: true });
        }
      }
      message.success('Warehouse ID copied', 1.5);
    } catch {
      message.error('Could not copy warehouse ID. Please copy it manually.');
    }
  };

  const handleToggleVisibility = (e) => {
    e.stopPropagation();
    if (onToggleVisibility) {
      const currentVisibility = getVisibilityStatus();
      const newVisibility = currentVisibility === 'visible' ? 'hidden' : 'visible';
      onToggleVisibility(warehouse, newVisibility);
    }
  };

  return (
    <div className="simple-warehouse-card">
      {/* Header */}
      <div className="simple-warehouse-card__header">
        <div className="simple-warehouse-card__id">
          {idLabel ? <span>{idLabel}</span> : (
            <button
              type="button"
              className="simple-warehouse-card__copy-id"
              onClick={handleCopyId}
              title="Copy warehouse ID"
              aria-label={`Copy warehouse ID ${warehouse.id}`}
            >
              #{warehouse.id}
            </button>
          )}
        </div>
        {statusContent || (
          <div
            className={`simple-warehouse-card__status ${getVisibilityClass()}`}
            role={onToggleVisibility ? "button" : undefined}
            tabIndex={onToggleVisibility ? 0 : undefined}
            aria-label={onToggleVisibility ? `Warehouse ${warehouse.id} visibility: ${getVisibilityStatus()}. Toggle visibility` : undefined}
            onKeyDown={e => { if (onToggleVisibility && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleToggleVisibility(e); } }}
            onClick={handleToggleVisibility}
            style={{ cursor: onToggleVisibility ? 'pointer' : 'default' }}
            title={onToggleVisibility ? 'Click to toggle visibility' : ''}
          >
            {getVisibilityStatus()}
          </div>
        )}
      </div>

      {/* Image */}
      {firstImage ? (
        <ImageWithFallback
          originalUrl={firstImage}
          variantUrl={imageVariant(warehouse.images, firstImage)}
          alt={`Warehouse ${warehouse.id}`}
          className="simple-warehouse-card__image"
          loading="lazy"
          crossOrigin="anonymous"
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
          </div>

          {microMarkets.length > 0 && (
            <ul className="simple-warehouse-card__micro-markets" aria-label="Micro-markets">
              {microMarkets.map(name => (
                <li key={name} className="simple-warehouse-card__micro-market-chip">{name}</li>
              ))}
            </ul>
          )}

          <div className="simple-warehouse-card__contact">
            <UserOutlined className="simple-warehouse-card__icon" />
            <span>{warehouse.contactPerson}</span>
            <PhoneOutlined className="simple-warehouse-card__icon simple-warehouse-card__icon--secondary" />
            <RedactedPhone warehouseId={warehouse.id} contactNumber={warehouse.contactNumber} />
          </div>
        </div>

        <div className="simple-warehouse-card__bottom-content">
          {/* Metrics */}
          <div className="simple-warehouse-card__metrics">
            <div className="simple-warehouse-card__metric">
              <span className="simple-warehouse-card__metric-label">Offered Area</span>
              <span className="simple-warehouse-card__metric-value">
                {formatSpace(warehouse.totalSpaceSqft)} sq ft
              </span>
              {Array.isArray(warehouse.totalSpaceSqft) && warehouse.totalSpaceSqft.length > 1 && (
                <div className="simple-warehouse-card__space-breakdown">
                  {warehouse.totalSpaceSqft.map((v, i) => (
                    <span key={i} className="simple-warehouse-card__space-chip">
                      {Number(v).toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
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

          {metaInfo && (
            <div style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: 12,
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.55)',
            }}>
              {metaInfo}
            </div>
          )}

          {/* Actions */}
          <div className="simple-warehouse-card__actions">
            {actions || (
              <>
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
                {isAdmin && (
                  <button
                    className="simple-warehouse-card__action-btn simple-warehouse-card__action-btn--danger"
                    onClick={(e) => { e.stopPropagation(); onDelete?.(warehouse); }}
                  >
                    <DeleteOutlined /> Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SimpleWarehouseCard);
