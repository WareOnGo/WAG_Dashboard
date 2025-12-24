import React, { useState } from 'react';
import { Row, Col, Empty, Pagination } from 'antd';
import SimpleWarehouseCard from './SimpleWarehouseCard';
import './CardView.css';

/**
 * Fixed CardView Component with stable pagination
 */
const CardView = ({ 
  warehouses = [], 
  loading = false, 
  onEdit, 
  onDelete, 
  onViewDetails
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Simple pagination handler - no complex logic
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (current, size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = warehouses.slice(startIndex, endIndex);

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

  return (
    <div className="card-view">
      <Row gutter={[16, 16]}>
        {paginatedData.map((warehouse) => (
          <Col key={warehouse.id} xs={24} sm={12} md={8} lg={6}>
            <SimpleWarehouseCard
              warehouse={warehouse}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
            />
          </Col>
        ))}
      </Row>
      
      {/* Simple Pagination - separate handlers to avoid conflicts */}
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
            showSizeChanger={true}
            showQuickJumper={false}
            showTotal={(total, range) => 
              `${range[0]}-${range[1]} of ${total} warehouses`
            }
            pageSizeOptions={['6', '12', '24', '48']}
            onChange={handlePageChange}
            onShowSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
};

export default CardView;