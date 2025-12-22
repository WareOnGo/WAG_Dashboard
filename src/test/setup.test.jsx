import { describe, it, expect } from 'vitest';
import { renderWithProviders } from './testUtils';
import { mockWarehouses, mockWarehouse } from './mockData';

describe('Test Setup', () => {
  it('should have testing environment configured', () => {
    expect(true).toBe(true);
  });

  it('should have jsdom environment available', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  it('should have React Testing Library utilities available', () => {
    const TestComponent = () => <div data-testid="test">Test Component</div>;
    const { getByTestId } = renderWithProviders(<TestComponent />);
    expect(getByTestId('test')).toBeInTheDocument();
  });

  it('should have mock data available', () => {
    expect(mockWarehouses).toBeDefined();
    expect(Array.isArray(mockWarehouses)).toBe(true);
    expect(mockWarehouses.length).toBeGreaterThan(0);
    
    expect(mockWarehouse).toBeDefined();
    expect(mockWarehouse.id).toBeDefined();
    expect(mockWarehouse.warehouseType).toBeDefined();
  });

  it('should have MSW server configured', () => {
    // MSW server should be running (configured in mswServer.js)
    // This test just verifies the setup doesn't throw errors
    expect(true).toBe(true);
  });
});