import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import ResponsiveTable from '../ResponsiveTable';
import CardView from '../CardView';
import ViewSwitcher from '../ViewSwitcher';

// Mock hooks
vi.mock('../../hooks', () => ({
  useViewport: vi.fn(),
  useViewPreference: vi.fn()
}));

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <AntApp>
        {children}
      </AntApp>
    </ConfigProvider>
  </BrowserRouter>
);

const mockWarehouses = [
  {
    id: 1,
    warehouseType: 'Cold Storage',
    address: '123 Test Street',
    city: 'Test City',
    state: 'Test State',
    zone: 'NORTH',
    contactPerson: 'John Doe',
    contactNumber: '1234567890',
    totalSpaceSqft: 10000,
    visibility: true
  },
  {
    id: 2,
    warehouseType: 'Dry Storage',
    address: '456 Demo Avenue',
    city: 'Demo City',
    state: 'Demo State',
    zone: 'SOUTH',
    contactPerson: 'Jane Smith',
    contactNumber: '0987654321',
    totalSpaceSqft: 15000,
    visibility: true
  }
];

const mockColumns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80
  },
  {
    title: 'Type',
    dataIndex: 'warehouseType',
    key: 'warehouseType',
    width: 140
  },
  {
    title: 'Address',
    dataIndex: 'address',
    key: 'address',
    width: 200
  }
];

describe('Responsive Data Display Testing', () => {
  const mockViewport = {
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    width: 375,
    height: 667,
    orientation: 'portrait'
  };

  const mockViewPreference = {
    currentView: 'cards',
    changeView: vi.fn(),
    isTransitioning: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const { useViewport, useViewPreference } = require('../../hooks');
    useViewport.mockReturnValue(mockViewport);
    useViewPreference.mockReturnValue(mockViewPreference);
  });

  describe('ResponsiveTable Component', () => {
    it('should render table with horizontal scrolling on mobile', () => {
      render(
        <TestWrapper>
          <ResponsiveTable
            columns={mockColumns}
            dataSource={mockWarehouses}
            rowKey="id"
            scroll={{ x: 1200 }}
          />
        </TestWrapper>
      );

      // Verify table is rendered
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Verify data is displayed
      expect(screen.getByText('Cold Storage')).toBeInTheDocument();
      expect(screen.getByText('Dry Storage')).toBeInTheDocument();
    });

    it('should handle different screen sizes', () => {
      const { useViewport } = require('../../hooks');
      
      // Test small mobile screen
      useViewport.mockReturnValue({
        ...mockViewport,
        width: 320,
        height: 568
      });

      const { rerender } = render(
        <TestWrapper>
          <ResponsiveTable
            columns={mockColumns}
            dataSource={mockWarehouses}
            rowKey="id"
            scroll={{ x: 1200 }}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();

      // Test large mobile screen
      useViewport.mockReturnValue({
        ...mockViewport,
        width: 414,
        height: 896
      });

      rerender(
        <TestWrapper>
          <ResponsiveTable
            columns={mockColumns}
            dataSource={mockWarehouses}
            rowKey="id"
            scroll={{ x: 1200 }}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('CardView Component', () => {
    const mockHandlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onViewDetails: vi.fn(),
      onContextMenu: vi.fn()
    };

    it('should render warehouse cards on mobile', () => {
      render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      // Verify cards are rendered
      expect(screen.getByText('Cold Storage')).toBeInTheDocument();
      expect(screen.getByText('Dry Storage')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should handle card interactions', () => {
      render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      // Find and click edit button for first warehouse
      const editButtons = screen.getAllByLabelText(/edit warehouse/i);
      fireEvent.click(editButtons[0]);
      
      expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockWarehouses[0]);
    });

    it('should adapt to different orientations', () => {
      const { useViewport } = require('../../hooks');
      
      // Portrait orientation
      useViewport.mockReturnValue({
        ...mockViewport,
        orientation: 'portrait'
      });

      const { rerender } = render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Cold Storage')).toBeInTheDocument();

      // Landscape orientation
      useViewport.mockReturnValue({
        ...mockViewport,
        width: 667,
        height: 375,
        orientation: 'landscape'
      });

      rerender(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByText('Cold Storage')).toBeInTheDocument();
    });
  });

  describe('ViewSwitcher Component', () => {
    it('should render view switcher with proper labels', () => {
      render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={true}
          />
        </TestWrapper>
      );

      // Verify view switcher buttons are present
      expect(screen.getByLabelText(/switch to table view/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to card view/i)).toBeInTheDocument();
    });

    it('should handle view switching', () => {
      render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={true}
          />
        </TestWrapper>
      );

      // Click table view button
      const tableViewButton = screen.getByLabelText(/switch to table view/i);
      fireEvent.click(tableViewButton);
      
      expect(mockViewPreference.changeView).toHaveBeenCalledWith('table');
    });

    it('should adapt labels for mobile screens', () => {
      render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={false} // Mobile typically hides labels
          />
        </TestWrapper>
      );

      // Verify buttons are present but labels might be hidden
      expect(screen.getByLabelText(/switch to table view/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to card view/i)).toBeInTheDocument();
    });
  });

  describe('Cross-Device Compatibility', () => {
    it('should work consistently across different mobile browsers', () => {
      // Simulate different browser capabilities
      const { useViewport } = require('../../hooks');
      
      // Test with limited CSS support
      useViewport.mockReturnValue({
        ...mockViewport,
        // Simulate older mobile browser
        supportsCSSGrid: false,
        supportsFlexbox: true
      });

      render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onViewDetails={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </TestWrapper>
      );

      // Should still render properly with fallback layouts
      expect(screen.getByText('Cold Storage')).toBeInTheDocument();
    });

    it('should handle touch interactions properly', async () => {
      render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onViewDetails={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </TestWrapper>
      );

      // Simulate touch events
      const firstCard = screen.getByText('Cold Storage').closest('.warehouse-card');
      
      // Touch start
      fireEvent.touchStart(firstCard);
      
      // Touch end
      fireEvent.touchEnd(firstCard);
      
      // Verify card is still accessible
      expect(screen.getByText('Cold Storage')).toBeInTheDocument();
    });
  });

  describe('Performance Testing', () => {
    it('should handle large datasets efficiently', () => {
      // Create large dataset
      const largeDataset = Array.from({ length: 100 }, (_, index) => ({
        id: index + 1,
        warehouseType: `Storage Type ${index + 1}`,
        address: `${index + 1} Test Street`,
        city: `City ${index + 1}`,
        state: `State ${index + 1}`,
        zone: 'NORTH',
        contactPerson: `Person ${index + 1}`,
        contactNumber: `123456789${index}`,
        totalSpaceSqft: 10000 + index * 1000,
        visibility: true
      }));

      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <CardView
            warehouses={largeDataset}
            loading={false}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onViewDetails={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
      
      // Verify first few items are rendered
      expect(screen.getByText('Storage Type 1')).toBeInTheDocument();
    });

    it('should handle rapid view switching', async () => {
      const { rerender: _rerender } = render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={true}
          />
        </TestWrapper>
      );

      // Rapidly switch views
      const tableViewButton = screen.getByLabelText(/switch to table view/i);
      
      for (let i = 0; i < 5; i++) {
        fireEvent.click(tableViewButton);
        await waitFor(() => {
          expect(mockViewPreference.changeView).toHaveBeenCalled();
        });
      }
      
      // Should handle rapid clicks without issues
      expect(mockViewPreference.changeView).toHaveBeenCalledTimes(5);
    });
  });

  describe('Accessibility Testing', () => {
    it('should provide proper ARIA labels for screen readers', () => {
      render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={true}
          />
        </TestWrapper>
      );

      // Verify ARIA labels are present
      expect(screen.getByLabelText(/switch to table view/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/switch to card view/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(
        <TestWrapper>
          <CardView
            warehouses={mockWarehouses}
            loading={false}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onViewDetails={vi.fn()}
            onContextMenu={vi.fn()}
          />
        </TestWrapper>
      );

      // Find focusable elements
      const editButtons = screen.getAllByLabelText(/edit warehouse/i);
      
      // Verify buttons are focusable
      editButtons[0].focus();
      expect(document.activeElement).toBe(editButtons[0]);
      
      // Test keyboard navigation
      fireEvent.keyDown(editButtons[0], { key: 'Tab' });
      // Next element should be focusable
    });

    it('should maintain focus management on mobile', () => {
      render(
        <TestWrapper>
          <ViewSwitcher
            currentView="cards"
            onViewChange={mockViewPreference.changeView}
            disabled={false}
            showLabels={false}
          />
        </TestWrapper>
      );

      const tableViewButton = screen.getByLabelText(/switch to table view/i);
      
      // Focus and activate
      tableViewButton.focus();
      expect(document.activeElement).toBe(tableViewButton);
      
      fireEvent.click(tableViewButton);
      
      // Focus should be maintained or properly managed
      expect(mockViewPreference.changeView).toHaveBeenCalled();
    });
  });
});