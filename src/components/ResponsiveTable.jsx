import React, { useState, useEffect, useRef } from 'react';
import { Table, Button } from 'antd';
import { useViewport } from '../hooks/useViewport';
import { useScrollOptimization } from '../hooks/usePerformanceOptimization';
import './ResponsiveTable.css';

/**
 * ResponsiveTable Component
 * 
 * A responsive table wrapper that provides:
 * - Horizontal scrolling with sticky column headers on mobile
 * - Maintains all table functionality (sorting, filtering, pagination)
 * - Proper touch scrolling behavior and momentum scrolling
 * - Optimized performance for mobile devices
 */
const ResponsiveTable = ({ 
  columns, 
  dataSource, 
  loading,
  pagination,
  onRow,
  scroll,
  className,
  ...tableProps 
}) => {
  const { isMobile, isTablet } = useViewport();
  const tableRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  
  // Scroll performance optimization
  const { optimizeScrollElement } = useScrollOptimization({
    throttleMs: 16,
    enableMomentum: true,
    preventBounce: true
  });

  // Enhanced scroll configuration for mobile
  const getScrollConfig = () => {
    const baseScroll = scroll || {};
    
    if (isMobile) {
      return {
        x: Math.max(baseScroll.x || 0, 1200), // Ensure minimum width for mobile scrolling
        y: baseScroll.y || 'calc(100vh - 300px)',
        scrollToFirstRowOnChange: true,
        ...baseScroll
      };
    }
    
    if (isTablet) {
      return {
        x: Math.max(baseScroll.x || 0, 1000),
        y: baseScroll.y || 'calc(100vh - 350px)',
        scrollToFirstRowOnChange: true,
        ...baseScroll
      };
    }
    
    return baseScroll;
  };

  // Handle scroll events for mobile optimization
  useEffect(() => {
    const tableElement = tableRef.current?.querySelector('.ant-table-body');
    
    if (!tableElement || !isMobile) return;

    // Apply scroll optimizations
    const cleanup = optimizeScrollElement(tableElement);

    const handleScroll = () => {
      setIsScrolling(true);
      
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    const handleTouchStart = () => {
      // Prevent iOS bounce scrolling when at edges
      tableElement.style.overflowX = 'scroll';
      tableElement.style.WebkitOverflowScrolling = 'touch';
    };

    tableElement.addEventListener('scroll', handleScroll, { passive: true });
    tableElement.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      tableElement.removeEventListener('scroll', handleScroll);
      tableElement.removeEventListener('touchstart', handleTouchStart);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      cleanup?.();
    };
  }, [isMobile, optimizeScrollElement]);

  // Optimize columns for mobile display
  const getOptimizedColumns = () => {
    if (!isMobile) return columns;

    return columns.map(column => ({
      ...column,
      // Ensure minimum width for touch targets
      width: Math.max(column.width || 120, 80),
      // Add ellipsis for long content on mobile
      ellipsis: column.ellipsis !== false ? { showTitle: false } : false,
      // Optimize render functions for mobile
      render: column.render || ((text) => (
        <div className="mobile-cell-content">
          {text}
        </div>
      ))
    }));
  };

  // Enhanced pagination for mobile
  const getMobilePagination = () => {
    if (!pagination) return false;
    
    if (isMobile) {
      return {
        ...pagination,
        showSizeChanger: false, // Hide size changer on mobile for space
        showQuickJumper: false, // Hide quick jumper on mobile
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        size: 'small',
        responsive: true,
        ...pagination
      };
    }
    
    return pagination;
  };

  const tableClasses = [
    'responsive-table',
    className,
    isMobile && 'responsive-table--mobile',
    isTablet && 'responsive-table--tablet',
    isScrolling && 'responsive-table--scrolling'
  ].filter(Boolean).join(' ');

  return (
    <div 
      ref={tableRef}
      className={tableClasses}
      data-testid="responsive-table"
    >
      {/* Mobile scroll indicator */}
      {isMobile && (
        <div className="mobile-scroll-hint">
          <span>← Scroll horizontally to see more →</span>
        </div>
      )}
      
      <Table
        columns={getOptimizedColumns()}
        dataSource={dataSource}
        loading={loading}
        pagination={getMobilePagination()}
        onRow={onRow}
        scroll={getScrollConfig()}
        size={isMobile ? 'small' : 'middle'}
        {...tableProps}
      />
      
      {/* Mobile scroll shadow indicators */}
      {isMobile && (
        <>
          <div className="scroll-shadow scroll-shadow--left" />
          <div className="scroll-shadow scroll-shadow--right" />
        </>
      )}
    </div>
  );
};

export default ResponsiveTable;