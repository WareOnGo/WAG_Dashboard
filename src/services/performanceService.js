/**
 * Performance Service
 * 
 * Provides performance optimization utilities for mobile devices:
 * - Critical resource prioritization
 * - Above-the-fold content optimization
 * - Performance monitoring and metrics
 * - Mobile-specific optimizations
 */

class PerformanceService {
  constructor() {
    this.metrics = {
      loadStart: null,
      domContentLoaded: null,
      loadComplete: null,
      firstContentfulPaint: null,
      largestContentfulPaint: null,
      firstInputDelay: null,
      cumulativeLayoutShift: null
    };
    
    this.observers = new Map();
    this.isInitialized = false;
    this.isMobile = window.innerWidth < 768;
    
    this.init();
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (this.isInitialized) return;
    
    this.isInitialized = true;
    this.metrics.loadStart = performance.now();
    
    // Monitor core web vitals
    this.observeWebVitals();
    
    // Monitor DOM content loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.metrics.domContentLoaded = performance.now();
      });
    } else {
      this.metrics.domContentLoaded = performance.now();
    }
    
    // Monitor window load
    if (document.readyState === 'complete') {
      this.metrics.loadComplete = performance.now();
    } else {
      window.addEventListener('load', () => {
        this.metrics.loadComplete = performance.now();
      });
    }
    
    // Optimize for mobile devices
    if (this.isMobile) {
      this.optimizeForMobile();
    }
  }

  /**
   * Observe Core Web Vitals
   */
  observeWebVitals() {
    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            this.metrics.firstContentfulPaint = fcpEntry.startTime;
            fcpObserver.disconnect();
          }
        });
        fcpObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('fcp', fcpObserver);
      } catch (error) {
        console.warn('FCP observer not supported:', error);
      }

      // Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported:', error);
      }

      // First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            this.metrics.firstInputDelay = entry.processingStart - entry.startTime;
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.set('fid', fidObserver);
      } catch (error) {
        console.warn('FID observer not supported:', error);
      }

      // Cumulative Layout Shift
      try {
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cumulativeLayoutShift = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      } catch (error) {
        console.warn('CLS observer not supported:', error);
      }
    }
  }

  /**
   * Apply mobile-specific optimizations
   */
  optimizeForMobile() {
    // Preload critical resources
    this.preloadCriticalResources();
    
    // Optimize touch events
    this.optimizeTouchEvents();
    
    // Reduce memory pressure
    this.optimizeMemoryUsage();
    
    // Enable hardware acceleration for critical elements
    this.enableHardwareAcceleration();
  }

  /**
   * Preload critical resources for faster initial render
   */
  preloadCriticalResources() {
    const criticalResources = [
      // Critical CSS (already loaded via link tags)
      // Critical fonts
      { href: '/fonts/critical-font.woff2', as: 'font', type: 'font/woff2' },
    ];

    criticalResources.forEach(resource => {
      if (resource.href && !document.querySelector(`link[href="${resource.href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource.href;
        link.as = resource.as;
        if (resource.type) link.type = resource.type;
        if (resource.crossorigin) link.crossOrigin = resource.crossorigin;
        document.head.appendChild(link);
      }
    });
  }

  /**
   * Optimize touch events for better responsiveness
   */
  optimizeTouchEvents() {
    // Add passive event listeners for better scroll performance
    const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'scroll'];
    
    passiveEvents.forEach(eventType => {
      document.addEventListener(eventType, () => {}, { passive: true });
    });

    // Prevent 300ms click delay on mobile
    if ('ontouchstart' in window) {
      document.addEventListener('touchstart', () => {}, { passive: true });
    }
  }

  /**
   * Optimize memory usage for mobile devices
   */
  optimizeMemoryUsage() {
    // Clean up unused resources periodically
    setInterval(() => {
      if (performance.memory) {
        const memoryInfo = performance.memory;
        const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
        
        if (usageRatio > 0.8) {
          // Trigger garbage collection if available
          if (window.gc) {
            window.gc();
          }
          
          // Clear unused caches
          this.clearUnusedCaches();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Enable hardware acceleration for critical elements
   */
  enableHardwareAcceleration() {
    const criticalSelectors = [
      '.ant-layout',
      '.ant-card',
      '.ant-table-wrapper',
      '.warehouse-card',
      '.mobile-header'
    ];

    criticalSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.style.transform = 'translateZ(0)';
        element.style.willChange = 'transform';
      });
    });
  }

  /**
   * Clear unused caches to free memory
   */
  clearUnusedCaches() {
    // Clear old localStorage entries
    try {
      const keys = Object.keys(localStorage);
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.timestamp && (now - item.timestamp) > maxAge) {
              localStorage.removeItem(key);
            }
          } catch {
            // Remove invalid cache entries
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * Prioritize above-the-fold content rendering
   */
  prioritizeAboveFold() {
    return new Promise((resolve) => {
      // Use requestIdleCallback for non-critical operations
      const scheduleNonCritical = (callback) => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(callback, { timeout: 1000 });
        } else {
          setTimeout(callback, 0);
        }
      };

      // Critical: Render header and main content area
      requestAnimationFrame(() => {
        // Mark critical content as ready
        document.body.classList.add('critical-content-ready');
        
        // Schedule non-critical content
        scheduleNonCritical(() => {
          document.body.classList.add('non-critical-content-ready');
          resolve();
        });
      });
    });
  }

  /**
   * Measure and ensure response times under 2 seconds
   */
  measureResponseTime(operationName, operation) {
    const startTime = performance.now();
    
    const finish = (result) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log slow operations
      if (duration > 2000) {
        console.warn(`Slow operation detected: ${operationName} took ${duration}ms`);
        
        // Report to monitoring service if available
        this.reportSlowOperation(operationName, duration);
      }
      
      return result;
    };

    if (operation instanceof Promise) {
      return operation.then(finish).catch(error => {
        finish(null);
        throw error;
      });
    } else {
      return finish(operation());
    }
  }

  /**
   * Report slow operations for monitoring
   */
  reportSlowOperation(operationName, duration) {
    // In a real app, this would send to analytics/monitoring service
    console.warn('Performance Alert:', {
      operation: operationName,
      duration,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink
      } : null
    });
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    const now = performance.now();
    
    return {
      ...this.metrics,
      totalLoadTime: this.metrics.loadComplete ? this.metrics.loadComplete - this.metrics.loadStart : null,
      domReadyTime: this.metrics.domContentLoaded ? this.metrics.domContentLoaded - this.metrics.loadStart : null,
      currentTime: now,
      isAcceptable: this.isPerformanceAcceptable()
    };
  }

  /**
   * Check if current performance is acceptable
   */
  isPerformanceAcceptable() {
    const metrics = this.metrics;
    
    // Core Web Vitals thresholds
    const thresholds = {
      fcp: 1800, // First Contentful Paint < 1.8s
      lcp: 2500, // Largest Contentful Paint < 2.5s
      fid: 100,  // First Input Delay < 100ms
      cls: 0.1   // Cumulative Layout Shift < 0.1
    };

    return (
      (!metrics.firstContentfulPaint || metrics.firstContentfulPaint < thresholds.fcp) &&
      (!metrics.largestContentfulPaint || metrics.largestContentfulPaint < thresholds.lcp) &&
      (!metrics.firstInputDelay || metrics.firstInputDelay < thresholds.fid) &&
      (!metrics.cumulativeLayoutShift || metrics.cumulativeLayoutShift < thresholds.cls)
    );
  }

  /**
   * Cleanup observers and resources
   */
  cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    this.observers.clear();
  }
}

// Create singleton instance
const performanceService = new PerformanceService();

export default performanceService;