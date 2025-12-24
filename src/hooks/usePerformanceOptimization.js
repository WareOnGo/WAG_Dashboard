import { useState, useEffect, useCallback, useRef } from 'react';
import { useViewport } from './useViewport';

/**
 * Custom hook for mobile performance optimizations
 * 
 * Provides:
 * - Touch event optimization
 * - Scroll performance enhancements
 * - Memory management for mobile devices
 * - Interaction delay prevention
 */
export const usePerformanceOptimization = () => {
  const { isMobile } = useViewport();
  const [isOptimized, setIsOptimized] = useState(false);

  useEffect(() => {
    if (!isMobile) return;

    // Enable performance optimizations for mobile
    setIsOptimized(true);

    // Optimize touch events
    const optimizeTouchEvents = () => {
      // Add passive event listeners for better scroll performance
      const passiveEvents = ['touchstart', 'touchmove', 'wheel'];
      
      passiveEvents.forEach(event => {
        document.addEventListener(event, () => {}, { passive: true });
      });

      return () => {
        passiveEvents.forEach(event => {
          document.removeEventListener(event, () => {});
        });
      };
    };

    const cleanup = optimizeTouchEvents();

    return cleanup;
  }, [isMobile]);

  return {
    isOptimized,
    isMobile
  };
};

/**
 * Hook for optimizing touch event handling
 */
export const useTouchOptimization = (options = {}) => {
  const { 
    preventDelay = true, 
    enableFastClick = true,
    touchThreshold = 10 
  } = options;
  
  const touchStartRef = useRef(null);
  const { isMobile } = useViewport();

  const handleTouchStart = useCallback((e) => {
    if (!isMobile || !preventDelay) return;

    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  }, [isMobile, preventDelay]);

  const handleTouchEnd = useCallback((e, onClick) => {
    if (!isMobile || !preventDelay || !touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = Math.abs(touchEnd.x - touchStartRef.current.x);
    const deltaY = Math.abs(touchEnd.y - touchStartRef.current.y);
    const deltaTime = touchEnd.time - touchStartRef.current.time;

    // If it's a quick tap with minimal movement, trigger click immediately
    if (
      deltaX < touchThreshold && 
      deltaY < touchThreshold && 
      deltaTime < 300 &&
      enableFastClick
    ) {
      e.preventDefault();
      onClick?.(e);
    }

    touchStartRef.current = null;
  }, [isMobile, preventDelay, enableFastClick, touchThreshold]);

  return {
    touchHandlers: isMobile ? {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd
    } : {},
    isMobile
  };
};

/**
 * Hook for scroll performance optimization
 */
export const useScrollOptimization = (options = {}) => {
  const { 
    throttleMs = 16, 
    enableMomentum = true,
    preventBounce = true 
  } = options;
  
  const { isMobile } = useViewport();
  const scrollTimeoutRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const optimizeScrollElement = useCallback((element) => {
    if (!element || !isMobile) return;

    // Enable momentum scrolling on iOS
    if (enableMomentum) {
      element.style.webkitOverflowScrolling = 'touch';
      element.style.overflowScrolling = 'touch';
    }

    // Prevent bounce scrolling
    if (preventBounce) {
      element.style.overscrollBehavior = 'contain';
    }

    // Optimize scroll events
    const handleScroll = () => {
      setIsScrolling(true);
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, throttleMs);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isMobile, enableMomentum, preventBounce, throttleMs]);

  return {
    optimizeScrollElement,
    isScrolling,
    isMobile
  };
};

/**
 * Hook for memory management on mobile devices
 */
export const useMemoryOptimization = () => {
  const { isMobile } = useViewport();
  const [memoryPressure, setMemoryPressure] = useState('normal');

  useEffect(() => {
    if (!isMobile || !navigator.deviceMemory) return;

    // Detect memory pressure based on device capabilities
    const deviceMemory = navigator.deviceMemory;
    
    if (deviceMemory <= 2) {
      setMemoryPressure('high');
    } else if (deviceMemory <= 4) {
      setMemoryPressure('medium');
    } else {
      setMemoryPressure('normal');
    }

    // Listen for memory pressure events if available
    if ('memory' in performance) {
      const checkMemory = () => {
        const memInfo = performance.memory;
        const usedRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        
        if (usedRatio > 0.8) {
          setMemoryPressure('high');
        } else if (usedRatio > 0.6) {
          setMemoryPressure('medium');
        } else {
          setMemoryPressure('normal');
        }
      };

      const interval = setInterval(checkMemory, 30000); // Check every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isMobile]);

  const shouldReduceQuality = memoryPressure === 'high';
  const shouldLimitConcurrency = memoryPressure !== 'normal';

  return {
    memoryPressure,
    shouldReduceQuality,
    shouldLimitConcurrency,
    isMobile
  };
};