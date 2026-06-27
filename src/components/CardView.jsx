import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Empty, Pagination } from 'antd';
import SimpleWarehouseCard from './SimpleWarehouseCard';
import { useViewport } from '../hooks/useViewport';
import './CardView.css';

/**
 * Fixed CardView Component with stable pagination
 */
const CardView = ({
  warehouses = [],
  loading = false,
  onEdit,
  onDelete,
  onViewDetails,
  onToggleVisibility,
  columnsPerRow = null, // null means auto-detect based on screen size
  getCardProps, // optional (warehouse) => extra props spread onto each card (used by the review queue)
  paginated = true, // when false, render all rows as-is (caller paginates server-side) and hide the internal pager
}) => {
  const { isMobile } = useViewport();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(isMobile ? 6 : 12);

  // Reset to first page whenever the dataset changes (filters/search applied upstream)
  useEffect(() => {
    setCurrentPage(1);
  }, [warehouses]);

  // Determine column span based on columnsPerRow prop or default behavior
  const colSpan = useMemo(() => {
    if (columnsPerRow === 2) {
      // 2 cards per row: 12 span each (24/2 = 12)
      return { xs: 24, sm: 12, md: 12, lg: 12, xl: 12 };
    }
    // Default: 4 cards per row on large screens
    return { xs: 24, sm: 12, md: 8, lg: 6 };
  }, [columnsPerRow]);

  // Simple pagination handler - no complex logic
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (current, size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Calculate pagination. When `paginated` is false the caller already supplies a
  // single page (server-side), so render the rows as-is and skip internal slicing.
  const paginatedData = useMemo(() => {
    if (!paginated) return warehouses;
    const startIndex = (currentPage - 1) * pageSize;
    return warehouses.slice(startIndex, startIndex + pageSize);
  }, [paginated, warehouses, currentPage, pageSize]);

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
          <Col key={warehouse.id} {...colSpan}>
            <SimpleWarehouseCard
              warehouse={warehouse}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetails={onViewDetails}
              onToggleVisibility={onToggleVisibility}
              {...(getCardProps ? getCardProps(warehouse) : {})}
            />
          </Col>
        ))}
      </Row>

      {/* Internal pagination (client-side). Skipped when the caller paginates server-side. */}
      {paginated && warehouses.length > pageSize && (
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

// Memoized: parent (Dashboard) passes a stable filtered list (useWarehouseFilters memoises it)
// and stable useCallback handlers, so cards don't re-render on unrelated Dashboard state changes.
export default React.memo(CardView);