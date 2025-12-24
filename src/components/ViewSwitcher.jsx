import React from 'react';
import { Button, Tooltip } from 'antd';
import { TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import './ViewSwitcher.css';

/**
 * ViewSwitcher Component
 * 
 * Provides toggle functionality between table and card views:
 * - Automatic view selection based on screen size
 * - Manual view switching with preference persistence
 * - Smooth transitions between view modes
 * - Touch-friendly controls for mobile
 */
const ViewSwitcher = ({ 
  currentView, 
  onViewChange, 
  disabled = false,
  showLabels = true 
}) => {
  const { isMobile, isTablet } = useViewport();

  // Get recommended view for current screen size
  const getRecommendedView = () => {
    return isMobile ? 'cards' : 'table';
  };

  // Handle view change
  const handleViewChange = (view) => {
    if (disabled || view === currentView) return;
    
    onViewChange(view);
    
    // Store preference in localStorage
    try {
      localStorage.setItem('warehouse-view-preference', view);
    } catch (error) {
      console.warn('Failed to save view preference:', error);
    }
  };

  const recommendedView = getRecommendedView();
  const isRecommendedView = currentView === recommendedView;

  return (
    <div className={`view-switcher ${isMobile ? 'view-switcher--mobile' : ''}`}>
      {/* View Toggle Buttons */}
      <div className="view-switcher__buttons">
        <Tooltip 
          title={isMobile ? "Table view (horizontal scroll)" : "Table view"}
          placement="top"
        >
          <Button
            type={currentView === 'table' ? 'primary' : 'default'}
            icon={<TableOutlined />}
            onClick={() => handleViewChange('table')}
            disabled={disabled}
            className={`view-switcher__button ${currentView === 'table' ? 'view-switcher__button--active' : ''}`}
            size={isMobile ? 'small' : 'middle'}
          >
            {showLabels && !isMobile && 'Table'}
          </Button>
        </Tooltip>

        <Tooltip 
          title={isMobile ? "Card view (mobile optimized)" : "Card view"}
          placement="top"
        >
          <Button
            type={currentView === 'cards' ? 'primary' : 'default'}
            icon={<AppstoreOutlined />}
            onClick={() => handleViewChange('cards')}
            disabled={disabled}
            className={`view-switcher__button ${currentView === 'cards' ? 'view-switcher__button--active' : ''}`}
            size={isMobile ? 'small' : 'middle'}
          >
            {showLabels && !isMobile && 'Cards'}
          </Button>
        </Tooltip>
      </div>

      {/* Recommendation Indicator */}
      {!isRecommendedView && (
        <div className="view-switcher__recommendation">
          <Tooltip 
            title={`${recommendedView === 'cards' ? 'Card' : 'Table'} view is recommended for your screen size`}
            placement="bottom"
          >
            <Button
              type="link"
              size="small"
              onClick={() => handleViewChange(recommendedView)}
              className="view-switcher__recommend-btn"
            >
              Use recommended
            </Button>
          </Tooltip>
        </div>
      )}

      {/* View Description */}
      {showLabels && (
        <div className="view-switcher__description">
          {currentView === 'table' ? (
            <span>
              {isMobile ? 'Horizontal scrolling table' : 'Full data table view'}
            </span>
          ) : (
            <span>
              {isMobile ? 'Mobile-optimized cards' : 'Card-based layout'}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewSwitcher;