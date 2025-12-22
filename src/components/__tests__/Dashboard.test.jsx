import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouses, mockApiErrors } from '../../test/mockData';
import Dashboard from '../Dashboard';
import * as warehouseService from '../../services/warehouseService';

// Mock the warehouse service
vi.mock('../../services/warehouseService', () => ({
  warehouseService: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the error handler utilities
vi.mock('../../utils/errorHandler', () => ({
  handleOperationError: vi.fn(),
  showSuccessMessage: vi.fn(),
  withRetry: vi.fn((fn) => fn()),
  clearErrors: vi.fn(),
}));

describe('Dashboard Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful response
    warehouseService.warehouseService.getAll.mockResolvedValue(mockWarehouses);
  });

  describe('Basic Rendering', () => {
    it('should render dashboard with warehouse list', async () => {
      renderWithProviders(<Dashboard />);

      // Check for main dashboard elements
      expect(screen.getByPlaceholderText('Search warehouses...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add warehouse/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();

      // Wait for warehouses to load
      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });
    });

    it('should display warehouse count in results', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });
    });

    it('should render table with warehouse data', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        // Check for warehouse data in table - there are 2 warehouses, one is Industrial, one is Cold Storage
        expect(screen.getAllByText('Industrial')).toHaveLength(2); // Header + data row
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('Test City')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state initially', async () => {
      // Mock a delayed response
      warehouseService.warehouseService.getAll.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockWarehouses), 100))
      );

      renderWithProviders(<Dashboard />);

      // Initially should not show results
      expect(screen.queryByText('2 of 2 results')).not.toBeInTheDocument();

      // Wait for loading to complete and results to appear
      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should handle empty warehouse list', async () => {
      warehouseService.warehouseService.getAll.mockResolvedValue([]);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('0 of 0 results')).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('should display error message when API call fails', async () => {
      const errorMessage = 'Failed to fetch warehouses';
      warehouseService.warehouseService.getAll.mockRejectedValue(new Error(errorMessage));

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      warehouseService.warehouseService.getAll.mockRejectedValue(mockApiErrors.networkError);

      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter warehouses by search text', async () => {
      renderWithProviders(<Dashboard />);

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.getByText('#2')).toBeInTheDocument();
      });

      // Search for specific warehouse
      const searchInput = screen.getByPlaceholderText('Search warehouses...');
      await user.type(searchInput, 'Industrial');

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText('1 of 2 results')).toBeInTheDocument();
        expect(screen.getByText('#1')).toBeInTheDocument();
        expect(screen.queryByText('#2')).not.toBeInTheDocument();
      });
    });

    it('should clear search when clear button is clicked', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search warehouses...');
      await user.type(searchInput, 'Industrial');

      await waitFor(() => {
        expect(screen.getByText('1 of 2 results')).toBeInTheDocument();
      });

      // Clear search
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Panel', () => {
    it('should toggle filter panel visibility', async () => {
      renderWithProviders(<Dashboard />);

      const filtersButton = screen.getByRole('button', { name: /filters/i });
      
      // Click to show filters
      await user.click(filtersButton);

      // Filter panel should be visible - check for filter-specific elements
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Filter by owner type')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Filter by warehouse type')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Filter by city')).toBeInTheDocument();
      });
    });

    it('should show clear filters button when filters are visible', async () => {
      renderWithProviders(<Dashboard />);

      // Wait for initial data load
      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });

      // Show filters
      await user.click(screen.getByRole('button', { name: /filters/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should open warehouse form when Add Warehouse is clicked', async () => {
      renderWithProviders(<Dashboard />);

      const addButton = screen.getByRole('button', { name: /add warehouse/i });
      await user.click(addButton);

      // Should show the warehouse form modal
      await waitFor(() => {
        expect(screen.getByText('Create New Warehouse')).toBeInTheDocument();
      });
    });

    it('should handle pagination changes', async () => {
      renderWithProviders(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText('2 of 2 results')).toBeInTheDocument();
      });

      // Check pagination controls are present - look for the pagination list without name requirement
      const paginationList = screen.getByRole('list');
      expect(paginationList).toBeInTheDocument();
      expect(paginationList).toHaveClass('ant-pagination');
    });
  });
});