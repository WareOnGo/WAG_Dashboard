import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Empty, Pagination } from 'antd';
import SimpleWarehouseCard from './SimpleWarehouseCard';
import { useViewport } from '../hooks/useViewport';
import './CardView.css';

/**
 * One shimmer block standing in for a line of text or a control.
 *
 * `line` names the row it replaces; every height and margin comes from
 * SimpleWarehouseCard.css, which is the only place that can see both the active
 * breakpoint and how wide the card ended up. Only widths are passed here, since
 * those are just the shape of the text being stood in for.
 */
const Block = ({ width, line }) => (
  <div className={`swc-skeleton__block swc-skeleton__line--${line}`} style={{ width }} />
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
const SkeletonCard = () => (
  <div className="simple-warehouse-card simple-warehouse-card--skeleton" aria-hidden="true">
    {/* Header: id on the left, visibility badge on the right */}
    <div className="simple-warehouse-card__header">
      <Block width={64} line="id" />
      <Block width={62} line="status" />
    </div>

    {/* Image — height, radius and spacing all come from the real class */}
    <div className="simple-warehouse-card__image swc-skeleton__block" />

    <div className="simple-warehouse-card__content">
      <div className="simple-warehouse-card__top-content">
        {/* Warehouse type, then owner type */}
        <Block width="55%" line="title" />
        <Block width="30%" line="owner" />

        {/* City, state and the zone tag */}
        <Block width="85%" line="location" />

        {/* The contact name, then the phone-reveal control below it */}
        <Block width="70%" line="contact" />
        <Block width={110} line="phone" />
      </div>

      <div className="simple-warehouse-card__bottom-content">
        {/* Metrics keep the real tinted grid, so the columns reflow where they do */}
        <div className="simple-warehouse-card__metrics">
          {['area', 'rate', 'docks'].map((key) => (
            <div className="simple-warehouse-card__metric" key={key}>
              <Block width="70%" line="metric-label" />
              <Block width="90%" line="metric-value" />

              {/* The offered-area metric carries the space-breakdown chips
                  whenever a warehouse lists more than one area. Reusing the real
                  container and the real chip widths (54 and 46) means these wrap
                  onto a second line at exactly the card widths the real ones do.
                  Cards stretch to the tallest in their row, so reserving this row
                  is the right way to be wrong when no warehouse on the page has it. */}
              {key === 'area' && (
                <div className="simple-warehouse-card__space-breakdown">
                  <Block width={54} line="chip" />
                  <Block width={46} line="chip" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions inherit the top border and gap from the real class */}
        <div className="simple-warehouse-card__actions">
          <Block line="action" />
          <Block line="action" />
        </div>
      </div>
    </div>
  </div>
);

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
              <SkeletonCard />
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