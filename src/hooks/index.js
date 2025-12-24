/**
 * Hooks barrel export file
 * Centralized exports for all custom hooks
 */

export { useErrorHandler } from './useErrorHandler.js';
export { useViewport, BREAKPOINTS } from './useViewport.js';
export { useViewPreference } from './useViewPreference.js';

// Performance optimization hooks
export { 
  useLazyLoading, 
  useLazyImage, 
  useLazyComponent 
} from './useLazyLoading.js';

export { 
  usePerformanceOptimization,
  useTouchOptimization,
  useScrollOptimization,
  useMemoryOptimization
} from './usePerformanceOptimization.js';

export { 
  useCache,
  useApiCache
} from './useCaching.js';

export { 
  usePerformanceMonitoring,
  useComponentPerformance
} from './usePerformanceMonitoring.js';

// Compatibility and device detection hooks
export { 
  useBrowserCompatibility, 
  addBrowserClasses, 
  isModernBrowser 
} from './useBrowserCompatibility.js';

export { 
  useDeviceFeatures, 
  addDeviceClasses, 
  requiresSpecialHandling 
} from './useDeviceFeatures.js';