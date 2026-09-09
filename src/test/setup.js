import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Global test setup
global.ResizeObserver = class ResizeObserver {
  constructor(cb) {
    this.cb = cb;
  }
  // jsdom does not perform layout. Tests needing resize delivery supply entries
  // explicitly instead of receiving a synchronous, malformed synthetic entry.
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Preserve CSS/visibility checks. jsdom cannot compute pseudo-element styles,
// which Ant Design requests while measuring scrollbars; omit only that argument.
const getComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, 'getComputedStyle', {
  configurable: true,
  writable: true,
  value: (element) => getComputedStyle(element),
});

// Mock URL.createObjectURL for file uploads
global.URL.createObjectURL = vi.fn(() => 'mocked-url');
global.URL.revokeObjectURL = vi.fn();

// Scrolling has no geometry in jsdom. Individual viewport tests can spy on these.
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
