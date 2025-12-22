import React from 'react';
import { render } from '@testing-library/react';
import { App, ConfigProvider, theme } from 'antd';

/**
 * Custom render function that wraps components with necessary providers
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Additional render options
 * @returns {Object} - Render result with additional utilities
 */
export function renderWithProviders(ui, options = {}) {
  const { initialProps = {}, ...renderOptions } = options;

  function Wrapper({ children }) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <App>
          {children}
        </App>
      </ConfigProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

/**
 * Create a mock file for testing file uploads
 * @param {string} name - File name
 * @param {string} type - MIME type
 * @param {number} size - File size in bytes
 * @returns {File} - Mock file object
 */
export function createMockFile(name = 'test.jpg', type = 'image/jpeg', size = 1024) {
  const file = new File(['mock file content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/**
 * Wait for async operations to complete
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} - Promise that resolves after the specified time
 */
export function waitFor(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock console methods for testing
 * @param {string} method - Console method to mock ('log', 'error', 'warn')
 * @returns {Object} - Mock function and restore function
 */
export function mockConsole(method = 'error') {
  const originalMethod = console[method];
  const mockFn = vi.fn();
  console[method] = mockFn;
  
  return {
    mockFn,
    restore: () => {
      console[method] = originalMethod;
    },
  };
}

/**
 * Create mock form data for testing
 * @param {Object} overrides - Properties to override in mock data
 * @returns {Object} - Mock form data
 */
export function createMockFormData(overrides = {}) {
  return {
    warehouseType: 'Test Warehouse',
    address: 'Test Address',
    city: 'Test City',
    state: 'Test State',
    zone: 'North',
    contactPerson: 'Test Person',
    contactNumber: '1234567890',
    totalSpaceSqft: [10000],
    ratePerSqft: '50',
    compliances: 'Test Compliance',
    uploadedBy: 'test@example.com',
    ...overrides,
  };
}

// Re-export everything from React Testing Library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';