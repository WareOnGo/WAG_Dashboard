import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Empty, Pagination } from 'antd';
import SimpleWarehouseCard from './SimpleWarehouseCard';
import { useViewport } from '../hooks/useViewport';
import './CardView.css';

/** One shimmer block standing in for a line of text or a control. */
const Block = ({ width, height, style }) => (
  <div className="swc-skeleton__block" style={{ width, height, ...style }} />
);

/**
 * Placeholder card shown while a page of warehouses loads.
 *
 * Built from SimpleWarehouseCard's own structural classes — header, image,
 * content, top/bottom content, metrics, actions — so every box, gap, border and
 * breakpoint comes from SimpleWarehouseCard.css rather than being restated here.
 * That is what keeps the placeholder the same shape as the thing it stands in
 * for: the only measurements below are the heights of the text lines being
 * replaced, which have no box of their own to inherit.
 *
 * The earlier version was a flat image-plus-paragraph stack, 181px shorter than
 * a real card and missing the header outright, so the grid jumped when a page
 * landed.
 */
const SkeletonCard = ({ isMobile }) => {
  // Block heights are the line boxes measured on a rendered card, not guesses:
  // id 22, status badge 27, title 21, owner type 19, location 22, metric label 15
  // over value 16. Mobile drops each font by ~1px, so the blocks follow.
  const m = isMobile;

  return (
    <div className="simple-warehouse-card simple-warehouse-card--skeleton" aria-hidden="true">
      {/* Header: id on the left, visibility badge on the right */}
      <div className="simple-warehouse-card__header">
        <Block width={64} height={m ? 20 : 22} />
        <Block width={62} height={m ? 25 : 27} />
      </div>

      {/* Image — height, radius and spacing all come from the real class */}
      <div className="simple-warehouse-card__image swc-skeleton__block" />

      <div className="simple-warehouse-card__content">
        <div className="simple-warehouse-card__top-content">
          {/* Warehouse type, then owner type */}
          <Block width="55%" height={m ? 20 : 21} style={{ marginBottom: 8 }} />
          <Block width="30%" height={m ? 17 : 19} style={{ marginBottom: 12 }} />

          {/* Location row: city, state and the zone tag */}
          <Block width="85%" height={m ? 20 : 22} style={{ marginBottom: m ? 6 : 8 }} />

          {/* Contact: the name, with the phone-reveal control below it — that
              control sits on its own line at the card widths this grid produces. */}
          <Block width="70%" height={m ? 20 : 22} style={{ marginBottom: 4 }} />
          <Block width={110} height={m ? 16 : 18} style={{ marginBottom: m ? 6 : 8 }} />
        </div>

        <div className="simple-warehouse-card__bottom-content">
          {/* Metrics keep the real tinted grid, so the columns wrap where they do */}
          <div className="simple-warehouse-card__metrics">
            {['area', 'rate', 'docks'].map((key) => (
              <div className="simple-warehouse-card__metric" key={key}>
                <Block width="70%" height={m ? 14 : 15} style={{ margin: '0 auto 4px' }} />
                <Block width="90%" height={m ? 15 : 16} style={{ margin: '0 auto' }} />
              </div>
            ))}
          </div>

          {/* Actions inherit the top border, gap and button height from the real class */}
          <div className="simple-warehouse-card__actions">
            <Block height={m ? 32 : 36} style={{ flex: 1 }} />
            <Block height={m ? 32 : 36} style={{ flex: 1 }} />
          </div>
        </div>
      </div>
    </div>
  );
};

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
    // Skeleton grid sized like a typical page so pagination/filter changes
    // don't collapse the layout while the next page loads.
    const skeletonCount = isMobile ? 4 : (columnsPerRow === 2 ? 6 : 8);
    return (
      <div className="card-view card-view--loading">
        <Row gutter={[16, 16]}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            <Col key={i} {...colSpan}>
              <SkeletonCard isMobile={isMobile} />
            </Col>
          ))}
        </Row>
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