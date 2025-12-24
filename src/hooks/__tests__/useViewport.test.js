import { renderHook, act } from '@testing-library/react';
import { useViewport, BREAKPOINTS } from '../useViewport';

// Mock window.innerWidth and window.innerHeight
const mockWindowDimensions = (width, height) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
};

// Mock window.addEventListener and removeEventListener
const mockEventListeners = () => {
  const listeners = {};
  window.addEventListener = vi.fn((event, callback) => {
    listeners[event] = callback;
  });
  window.removeEventListener = vi.fn();
  return listeners;
};

describe('useViewport', () => {
  let listeners;

  beforeEach(() => {
    listeners = mockEventListeners();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should initialize with mobile viewport', () => {
      mockWindowDimensions(375, 667); // iPhone dimensions
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.width).toBe(375);
      expect(result.current.height).toBe(667);
      expect(result.current.isMobile).toBe(true);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.orientation).toBe('portrait');
    });

    it('should initialize with tablet viewport', () => {
      mockWindowDimensions(768, 1024); // iPad dimensions
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.width).toBe(768);
      expect(result.current.height).toBe(1024);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(true);
      expect(result.current.isDesktop).toBe(false);
      expect(result.current.orientation).toBe('portrait');
    });

    it('should initialize with desktop viewport', () => {
      mockWindowDimensions(1200, 800); // Desktop dimensions
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.width).toBe(1200);
      expect(result.current.height).toBe(800);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isTablet).toBe(false);
      expect(result.current.isDesktop).toBe(true);
      expect(result.current.orientation).toBe('landscape');
    });
  });

  describe('Breakpoint detection', () => {
    it('should correctly identify mobile breakpoint', () => {
      mockWindowDimensions(375, 667);
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.isBreakpoint('mobile')).toBe(true);
      expect(result.current.isBreakpoint('tablet')).toBe(false);
      expect(result.current.isBreakpoint('desktop')).toBe(false);
    });

    it('should correctly use isAtLeast helper', () => {
      mockWindowDimensions(800, 600);
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.isAtLeast('mobile')).toBe(true);
      expect(result.current.isAtLeast('tablet')).toBe(true);
      expect(result.current.isAtLeast('desktop')).toBe(false);
    });

    it('should correctly use isBelow helper', () => {
      mockWindowDimensions(600, 400);
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.isBelow('tablet')).toBe(true);
      expect(result.current.isBelow('desktop')).toBe(true);
      expect(result.current.isBelow('mobile')).toBe(false);
    });
  });

  describe('Responsive values', () => {
    it('should return correct responsive value for mobile', () => {
      mockWindowDimensions(375, 667);
      
      const { result } = renderHook(() => useViewport());
      
      const values = {
        mobile: 'mobile-value',
        tablet: 'tablet-value',
        desktop: 'desktop-value'
      };
      
      expect(result.current.getResponsiveValue(values)).toBe('mobile-value');
    });

    it('should return correct responsive value for tablet', () => {
      mockWindowDimensions(800, 600);
      
      const { result } = renderHook(() => useViewport());
      
      const values = {
        mobile: 'mobile-value',
        tablet: 'tablet-value',
        desktop: 'desktop-value'
      };
      
      expect(result.current.getResponsiveValue(values)).toBe('tablet-value');
    });

    it('should fallback to default value when specific breakpoint not provided', () => {
      mockWindowDimensions(375, 667);
      
      const { result } = renderHook(() => useViewport());
      
      const values = {
        default: 'default-value',
        desktop: 'desktop-value'
      };
      
      expect(result.current.getResponsiveValue(values)).toBe('default-value');
    });
  });

  describe('Resize handling', () => {
    it('should update viewport state on window resize', async () => {
      mockWindowDimensions(375, 667);
      
      const { result } = renderHook(() => useViewport());
      
      expect(result.current.isMobile).toBe(true);
      
      // Simulate window resize
      mockWindowDimensions(1200, 800);
      
      act(() => {
        listeners.resize();
      });
      
      // Wait for debounced update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      
      expect(result.current.width).toBe(1200);
      expect(result.current.height).toBe(800);
      expect(result.current.isMobile).toBe(false);
      expect(result.current.isDesktop).toBe(true);
    });
  });

  describe('Breakpoints export', () => {
    it('should export correct breakpoint values', () => {
      expect(BREAKPOINTS).toEqual({
        mobile: 320,
        tablet: 768,
        desktop: 1024,
        large: 1440
      });
    });
  });
});