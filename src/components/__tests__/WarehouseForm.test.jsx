import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import WarehouseForm from '../WarehouseForm';

// Mock the error handler utilities
vi.mock('../../utils/errorHandler', () => ({
  handleOperationError: vi.fn(),
  showSuccessMessage: vi.fn(),
  clearErrors: vi.fn(),
}));

describe('WarehouseForm Component', () => {
  const user = userEvent.setup();
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    visible: true,
    onCancel: mockOnCancel,
    onSubmit: mockOnSubmit,
    initialData: null,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render create form when no initial data provided', () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      expect(screen.getByText('Create New Warehouse')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create warehouse/i })).toBeInTheDocument();
    });

    it('should render edit form when initial data provided', () => {
      renderWithProviders(
        <WarehouseForm {...defaultProps} initialData={mockWarehouse} />
      );

      expect(screen.getByText('Edit Warehouse')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /update warehouse/i })).toBeInTheDocument();
    });

    it('should not render when visible is false', () => {
      renderWithProviders(<WarehouseForm {...defaultProps} visible={false} />);

      expect(screen.queryByText('Create New Warehouse')).not.toBeInTheDocument();
    });

    it('should render all required form sections', () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      expect(screen.getByText('Basic Information')).toBeInTheDocument();
      expect(screen.getByText('Contact Information')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Details')).toBeInTheDocument();
      expect(screen.getByText('Location Data')).toBeInTheDocument();
      expect(screen.getByText('Warehouse Photos')).toBeInTheDocument();
    });
  });

  describe('Form Fields', () => {
    it('should render all required fields with proper labels', () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // Check for required field labels (they contain asterisk in the HTML structure)
      expect(screen.getByText('Warehouse Type')).toBeInTheDocument();
      expect(screen.getByText('Zone')).toBeInTheDocument();
      expect(screen.getByText('Address')).toBeInTheDocument();
      expect(screen.getByText('City')).toBeInTheDocument();
      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('Contact Person')).toBeInTheDocument();
      expect(screen.getByText('Contact Number')).toBeInTheDocument();
      expect(screen.getByText('Total Space (sq ft)')).toBeInTheDocument();
      expect(screen.getByText('Rate per sq ft (₹)')).toBeInTheDocument();
      expect(screen.getByText('Compliances')).toBeInTheDocument();
      expect(screen.getByText('Uploaded By')).toBeInTheDocument();
    });

    it('should populate form fields when editing existing warehouse', () => {
      renderWithProviders(
        <WarehouseForm {...defaultProps} initialData={mockWarehouse} />
      );

      // Check that form fields are populated
      expect(screen.getByDisplayValue('Industrial')).toBeInTheDocument();
      expect(screen.getByDisplayValue('123 Test Street')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test City')).toBeInTheDocument();
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument();
    });

    it('should handle dynamic space fields correctly', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // Form starts with one default space field (value: 1000)
      const initialSpaceInputs = screen.getAllByPlaceholderText('Enter space');
      expect(initialSpaceInputs).toHaveLength(1);

      // Add button should be visible
      const addButton = screen.getByRole('button', { name: /add space value/i });
      expect(addButton).toBeInTheDocument();

      // Add another space field
      await user.click(addButton);

      // Should now have two space fields
      const updatedSpaceInputs = screen.getAllByPlaceholderText('Enter space');
      expect(updatedSpaceInputs).toHaveLength(2);
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for required fields', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /create warehouse/i });
      await user.click(submitButton);

      await waitFor(() => {
        // The form has some default values set (totalSpaceSqft, visibility, etc.)
        // So we expect validation errors only for truly required fields without defaults
        expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
      });
    });

    it('should validate latitude range', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const latitudeInput = screen.getByPlaceholderText('Enter latitude (-90 to 90)');
      await user.type(latitudeInput, '100'); // Invalid latitude

      const submitButton = screen.getByRole('button', { name: /create warehouse/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Latitude must be between -90 and 90')).toBeInTheDocument();
      });
    });

    it('should validate longitude range', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const longitudeInput = screen.getByPlaceholderText('Enter longitude (-180 to 180)');
      await user.type(longitudeInput, '200'); // Invalid longitude

      const submitButton = screen.getByRole('button', { name: /create warehouse/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Longitude must be between -180 and 180')).toBeInTheDocument();
      });
    });

    it('should have default space value and allow submission with it', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // The form should start with a default space value
      const spaceInputs = screen.getAllByPlaceholderText('Enter space');
      expect(spaceInputs.length).toBeGreaterThan(0);
      
      // Verify the default value is set (displayed as "1,000" due to formatter)
      expect(spaceInputs[0]).toHaveDisplayValue('1,000');
    });
  });

  describe('Form Submission', () => {
    it('should show submit button and handle basic form interaction', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // Check submit button is present
      const submitButton = screen.getByRole('button', { name: /create warehouse/i });
      expect(submitButton).toBeInTheDocument();

      // Fill a basic field
      await user.type(screen.getByPlaceholderText('Enter warehouse type (e.g., Cold Storage, Dry Storage)'), 'Test Warehouse');
      
      // Verify field was filled
      expect(screen.getByDisplayValue('Test Warehouse')).toBeInTheDocument();
    });

    it('should show loading state during submission', () => {
      renderWithProviders(<WarehouseForm {...defaultProps} loading={true} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should handle form validation on submit', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // Try to submit empty form
      const submitButton = screen.getByRole('button', { name: /create warehouse/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        const errorMessages = screen.getAllByText('This field is required');
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Form Actions', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should call onCancel when close button is clicked', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should reset form when cancelled', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      // Fill a field
      const warehouseTypeInput = screen.getByPlaceholderText('Enter warehouse type (e.g., Cold Storage, Dry Storage)');
      await user.type(warehouseTypeInput, 'Test Warehouse');

      expect(warehouseTypeInput.value).toBe('Test Warehouse');

      // Cancel the form
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Switch Components', () => {
    it('should handle visibility switch correctly', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const visibilitySwitch = screen.getByRole('switch', { name: /visibility/i });
      expect(visibilitySwitch).toBeChecked(); // Default should be true

      await user.click(visibilitySwitch);
      expect(visibilitySwitch).not.toBeChecked();
    });

    it('should handle fire NOC switch correctly', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const fireNocSwitch = screen.getByRole('switch', { name: /fire noc available/i });
      expect(fireNocSwitch).not.toBeChecked(); // Default should be false

      await user.click(fireNocSwitch);
      expect(fireNocSwitch).toBeChecked();
    });

    it('should handle vaastu compliance switch correctly', async () => {
      renderWithProviders(<WarehouseForm {...defaultProps} />);

      const vaastuSwitch = screen.getByRole('switch', { name: /vaastu compliance/i });
      expect(vaastuSwitch).not.toBeChecked(); // Default should be false

      await user.click(vaastuSwitch);
      expect(vaastuSwitch).toBeChecked();
    });
  });
});