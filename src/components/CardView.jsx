import React, { useState, useMemo } from 'react';
import { Row, Col, Empty, Pagination } from 'antd';
import { useViewport } from '../hooks/useViewport';
import SimpleWarehouseCard from './SimpleWarehouseCard';
import './CardView.css';

/**
 * CardView Component with Pagination
 */
const CardView = ({ 
  warehouses, 
  loading, 
  onEdit, 
  onDelete, 
  onViewDetails,
  onContextMenu 
}) => {
  const { isMobile, isTablet } = useViewport();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 6 : isTablet ? 8 : 12);

  // Calculate paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return warehouses.slice(startIndex, endIndex);
  }, [warehouses, currentPage, pageSize]);

  // Get responsive column configuration
  const getColumnConfig = () => {
    if (isMobile) {
      return {
        xs: 24, // 1 column on mobile
        sm: 24,
        md: 24,
        lg: 24,
        xl: 24,
        xxl: 24
      };
    }
    
    if (isTablet) {
      return {
        xs: 24,
        sm: 12, // 2 columns on tablet
        md: 12,
        lg: 12,
        xl: 12,
        xxl: 12
      };
    }
    
    // Desktop: 3-4 columns depending on screen size
    return {
      xs: 24,
      sm: 12,
      md: 8,  // 3 columns
      lg: 6,  // 4 columns
      xl: 6,
      xxl: 4  // 6 columns on very large screens
    };
  };

  // Get responsive gutter spacing
  const getGutterConfig = () => {
    if (isMobile) {
      return [12, 12];
    }
    
    if (isTablet) {
      return [16, 16];
    }
    
    return [20, 20];
  };

  if (loading) {
    return (
      <div className="card-view card-view--loading">
        <div style={{ 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          color: 'rgba(255, 255, 255, 0.65)'
        }}>
          Loading warehouses...
        </div>
      </div>
    );
  }

  if (!warehouses || warehouses.length === 0) {
    return (
      <div className="card-view card-view--empty">
        <Empty
          description="No warehouses found"
          style={{ 
            color: 'rgba(255, 255, 255, 0.65)',
            padding: '40px 20px'
          }}
        />
      </div>
    );
  }

  const columnConfig = getColumnConfig();
  const gutterConfig = getGutterConfig();

  return (
    <div className={`card-view ${isMobile ? 'card-view--mobile' : ''} ${isTablet ? 'card-view--tablet' : ''}`}>
      <Row gutter={gutterConfig}>
        {paginatedData.map((warehouse) => (
          <Col key={warehouse.id} {...columnConfig}>
            <SimpleWarehouseCard
              warehouse={warehouse}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
            />
          </Col>
        ))}
      </Row>
      
      {/* Pagination */}
      {warehouses.length > pageSize && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginTop: '24px',
          padding: '16px'
        }}>
          <Pagination
            current={currentPage}
            total={warehouses.length}
            pageSize={pageSize}
            showSizeChanger={!isMobile}
            showQuickJumper={!isMobile}
            showTotal={(total, range) => 
              `${range[0]}-${range[1]} of ${total} warehouses`
            }
            pageSizeOptions={['6', '12', '24', '48']}
            onChange={(page, size) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
                setCurrentPage(1); // Reset to first page when changing page size
              }
            }}
            style={{
              '& .ant-pagination-item': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: 'rgba(255, 255, 255, 0.2)'
              },
              '& .ant-pagination-item-active': {
                backgroundColor: '#1890ff',
                borderColor: '#1890ff'
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CardView;