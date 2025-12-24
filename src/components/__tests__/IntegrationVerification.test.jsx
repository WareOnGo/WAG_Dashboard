import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme, App as AntApp } from 'antd';
import Dashboard from '../Dashboard';

// Mock the hooks with proper implementations
vi.mock('../../hooks', () => ({
  useViewport: vi.fn(),
  useViewPreference: vi.fn(),
  useApiCache: vi.fn(),
  usePerformanceMonitoring: vi.fn(),
  useErrorHandler: vi.fn()
}));

// Mock the services
vi.mock('../../services/warehouseService', () => ({
  warehouseService: {
    getAll: vi.fn().mockResolvedValue([
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
      }
    ]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock performance service
vi.mock('../../services/performanceService', () => ({
  default: {
    measureResponseTime: vi.fn().mockResolvedValue(100),
    prioritizeAboveFold: vi.fn().mockResolvedValue(),
    preloadCriticalResources: vi.fn(),
    cleanup: vi.fn()
  }
}));

// Mock utils
vi.mock('../../utils/errorHandler', () => ({
  showSuccessMessage: vi.fn(),
  withRetry: vi.fn().mockImplementation((fn) => fn()),
  clearErrors: vi.fn(),
  ERROR_TYPES: {
    VALIDATION: 'validation',
    NOT_FOUND: 'not_found',
    NETWORK: 'network',
    SERVER: 'server',
    UPLOAD: 'upload',
    GENERIC: 'generic'
  }
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

describe('Mobile Integration Verification', () => {
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

  const mockApiCache = {
    cacheApiCall: vi.fn().mockImplementation((key, fn) => fn()),
    isOnline: true
  };

  const mockPerformanceMonitoring = {
    measureAsync: vi.fn().mockImplementation((name, fn) => fn()),
    getPerformanceSummary: vi.fn().mockReturnValue({})
  };

  const mockErrorHandler = {
    handleError: vi.fn(),
    clearErrors: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const { 
      useViewport, 
      useViewPreference, 
      useApiCache,
      usePerformanceMonitoring,
      useErrorHandler
    } = require('../../hooks');
    
    useViewport.mockReturnValue(mockViewport);
    useViewPreference.mockReturnValue(mockViewPreference);
    useApiCache.mockReturnValue(mockApiCache);
    usePerformanceMonitoring.mockReturnValue(mockPerformanceMonitoring);
    useErrorHandler.mockReturnValue(mockErrorHandler);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Task 9.1: Mobile Component Integration', () => {
    it('should render Dashboard with all mobile components integrated', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // Verify core dashboard elements are present
      expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      
      // Verify mobile-specific elements
      const filterButton = screen.getByRole('button', { name: /filters/i });
      expect(filterButton).toBeInTheDocument();
      
      // Verify view switcher is present
      const viewSwitcher = screen.getByLabelText(/switch to table view/i);
      expect(viewSwitcher).toBeInTheDocument();
    });

    it('should handle mobile filter integration', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // Open mobile filters
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      // Wait for filter drawer to appear
      await waitFor(() => {
        expect(screen.getByText('Filter Warehouses')).toBeInTheDocument();
      });
      
      // Verify filter controls are present
      expect(screen.getByText('Owner Type')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Type')).toBeInTheDocument();
      expect(screen.getByText('Clear All Filters')).toBeInTheDocument();
    });

    it('should handle view switching integration', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // Switch to table view
      const tableViewButton = screen.getByLabelText(/switch to table view/i);
      fireEvent.click(tableViewButton);
      
      expect(mockViewPreference.changeView).toHaveBeenCalledWith('table');
    });

    it('should handle form integration on mobile', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // Click add warehouse button
      const addButton = screen.getByText('Add Warehouse');
      fireEvent.click(addButton);
      
      // Wait for form modal to open
      await waitFor(() => {
        expect(screen.getByText('Add New Warehouse')).toBeInTheDocument();
      });
      
      // Verify form is present
      const form = screen.getByRole('dialog');
      expect(form).toBeInTheDocument();
    });
  });

  describe('Task 9.1: Desktop Functionality Preservation', () => {
    beforeEach(() => {
      const { useViewport } = require('../../hooks');
      useViewport.mockReturnValue({
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1024,
        height: 768,
        orientation: 'landscape'
      });
    });

    it('should preserve desktop functionality when not on mobile', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // Verify desktop elements are present
      expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      
      // Open filters - should show inline panel, not drawer
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      // Desktop should show inline filter panel
      await waitFor(() => {
        expect(screen.getByText('Owner Type')).toBeInTheDocument();
      });
      
      // Should NOT show mobile drawer title
      expect(screen.queryByText('Filter Warehouses')).not.toBeInTheDocument();
    });
  });

  describe('Task 9.2: Comprehensive Mobile Testing', () => {
    describe('Different Screen Sizes', () => {
      it('should work on small mobile screens (320px)', async () => {
        const { useViewport } = require('../../hooks');
        useViewport.mockReturnValue({
          ...mockViewport,
          width: 320,
          height: 568
        });

        render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });

        // Verify components still render properly on small screens
        expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      });

      it('should work on large mobile screens (414px)', async () => {
        const { useViewport } = require('../../hooks');
        useViewport.mockReturnValue({
          ...mockViewport,
          width: 414,
          height: 896
        });

        render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });

        // Verify components render properly on larger mobile screens
        expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
      });
    });

    describe('Orientation Changes', () => {
      it('should handle portrait to landscape orientation change', async () => {
        const { useViewport } = require('../../hooks');
        
        // Start in portrait
        useViewport.mockReturnValue({
          ...mockViewport,
          orientation: 'portrait'
        });

        const { rerender } = render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });

        // Change to landscape
        useViewport.mockReturnValue({
          ...mockViewport,
          width: 667,
          height: 375,
          orientation: 'landscape'
        });

        rerender(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        // Verify app still works in landscape
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });
      });
    });

    describe('Performance on Mobile', () => {
      it('should initialize with performance monitoring', async () => {
        render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        // Verify performance monitoring is called
        expect(mockPerformanceMonitoring.measureAsync).toHaveBeenCalled();
        
        // Verify app loads
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });
      });

      it('should handle caching appropriately on mobile', async () => {
        render(
          <TestWrapper>
            <Dashboard />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
        });

        // Verify caching is used for API calls
        expect(mockApiCache.cacheApiCall).toHaveBeenCalled();
      });
    });
  });

  describe('Complete User Workflows', () => {
    it('should handle complete warehouse management workflow on mobile', async () => {
      render(
        <TestWrapper>
          <Dashboard />
        </TestWrapper>
      );
      
      // 1. App loads
      await waitFor(() => {
        expect(screen.getByText('Add Warehouse')).toBeInTheDocument();
      });

      // 2. User opens filters
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      await waitFor(() => {
        expect(screen.getByText('Filter Warehouses')).toBeInTheDocument();
      });

      // 3. User applies filter
      const searchInput = screen.getByPlaceholderText('Search warehouses...');
      fireEvent.change(searchInput, { target: { value: 'Cold' } });
      
      // 4. User closes filters
      const closeFilterButton = screen.getByLabelText('Close filters');
      fireEvent.click(closeFilterButton);
      
      // 5. User switches view
      const tableViewButton = screen.getByLabelText(/switch to table view/i);
      fireEvent.click(tableViewButton);
      
      expect(mockViewPreference.changeView).toHaveBeenCalledWith('table');

      // 6. User opens add form
      const addButton = screen.getByText('Add Warehouse');
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('Add New Warehouse')).toBeInTheDocument();
      });

      // 7. User cancels form
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Add New Warehouse')).not.toBeInTheDocument();
      });
    });
  });
});