import { Button, Pagination } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import './ListingPagination.css';

export default function ListingPagination({ current, total, pageSize, onChange, pageSizeOptions, disabled = false }) {
  const { isMobile } = useViewport();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (current - 1) * pageSize + 1 : 0;
  const end = Math.min(current * pageSize, total);

  if (!isMobile) {
    return <Pagination
      className="listing-pagination"
      current={current}
      total={total}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      showSizeChanger
      showQuickJumper={false}
      showTotal={(count, range) => `${range[0]}–${range[1]} of ${count}`}
      disabled={disabled}
      onChange={onChange}
    />;
  }

  return (
    <nav className="listing-pagination listing-pagination--mobile" aria-label="Listing pagination">
      <div className="listing-pagination__summary" role="status">
        <span>{start}–{end} of {total}</span>
        <span>Page {current} of {pageCount}</span>
      </div>
      <div className="listing-pagination__controls">
        <Button icon={<LeftOutlined />} aria-label="Previous page"
          disabled={disabled || current <= 1} onClick={() => onChange(current - 1, pageSize)}>
          Previous
        </Button>
        <Button className="listing-pagination__next" type="primary" aria-label="Next page"
          disabled={disabled || current >= pageCount} onClick={() => onChange(current + 1, pageSize)}>
          Next <RightOutlined />
        </Button>
      </div>
    </nav>
  );
}
