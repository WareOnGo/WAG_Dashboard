import { useState, useEffect, useCallback, useRef } from 'react';
import { useViewport } from './useViewport';

/**
 * Custom hook for performance monitoring on mobile devices
 * 
 * Provides:
 * - Response time tracking
 * - Memory usage monitoring
 * - Network performance metrics
 * - Mobile-specific performance indicators
 */
export const usePerformanceMonitoring = (options = {}) => {
  const { 
    enableMemoryMonitoring = true,
    enableNetworkMonitoring = true,
    sampleRate = 0.1, // 10% sampling rate
    maxMetrics = 100
  } = options;

  const { isMobile } = useViewport();
  const [metrics, setMetrics] = useState({
    responseTime: [],
    memoryUsage: [],
    networkSpeed: null,
    deviceInfo: null
  });

  const metricsRef = useRef(metrics);
  const startTimeRef = useRef(null);

  // Update ref when metrics change
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Initialize device info
  useEffect(() => {
    if (!isMobile) return;

    const deviceInfo = {
      userAgent: navigator.userAgent,
      deviceMemory: navigator.deviceMemory || 'unknown',
      hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      screen: {
        width: screen.width,
        height: screen.height,
        pixelRatio: window.devicePixelRatio
      }
    };

    setMetrics(prev => ({
      ...prev,
      deviceInfo
    }));
  }, [isMobile]);

  // Memory monitoring
  useEffect(() => {
    if (!enableMemoryMonitoring || !isMobile || !performance.memory) return;

    const monitorMemory = () => {
      const memInfo = performance.memory;
      const memoryUsage = {
        used: memInfo.usedJSHeapSize,
        total: memInfo.totalJSHeapSize,
        limit: memInfo.jsHeapSizeLimit,
        timestamp: Date.now()
      };

      setMetrics(prev => ({
        ...prev,
        memoryUsage: [...prev.memoryUsage.slice(-maxMetrics + 1), memoryUsage]
      }));
    };

    // Monitor memory every 30 seconds
    const interval = setInterval(monitorMemory, 30000);
    monitorMemory(); // Initial measurement

    return () => clearInterval(interval);
  }, [enableMemoryMonitoring, isMobile, maxMetrics]);

  // Network monitoring
  useEffect(() => {
    if (!enableNetworkMonitoring || !isMobile || !navigator.connection) return;

    const updateNetworkInfo = () => {
      const connection = navigator.connection;
      setMetrics(prev => ({
        ...prev,
        networkSpeed: {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
          timestamp: Date.now()
        }
      }));
    };

    navigator.connection.addEventListener('change', updateNetworkInfo);
    updateNetworkInfo(); // Initial measurement

    return () => {
      navigator.connection.removeEventListener('change', updateNetworkInfo);
    };
  }, [enableNetworkMonitoring, isMobile]);

  // Start timing an operation
  const startTiming = useCallback((operationName) => {
    if (!isMobile || Math.random() > sampleRate) return null;

    const startTime = performance.now();
    startTimeRef.current = { operationName, startTime };
    
    return startTime;
  }, [isMobile, sampleRate]);

  // End timing and record the result
  const endTiming = useCallback((operationName) => {
    if (!startTimeRef.current || startTimeRef.current.operationName !== operationName) {
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTimeRef.current.startTime;
    
    const responseTime = {
      operation: operationName,
      duration,
      timestamp: Date.now()
    };

    setMetrics(prev => ({
      ...prev,
      responseTime: [...prev.responseTime.slice(-maxMetrics + 1), responseTime]
    }));

    startTimeRef.current = null;
    return duration;
  }, [maxMetrics]);

  // Measure function execution time
  const measureAsync = useCallback(async (operationName, asyncFn) => {
    const startTime = startTiming(operationName);
    if (startTime === null) {
      return await asyncFn();
    }

    try {
      const result = await asyncFn();
      endTiming(operationName);
      return result;
    } catch (error) {
      endTiming(operationName);
      throw error;
    }
  }, [startTiming, endTiming]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const current = metricsRef.current;
    
    if (!isMobile) {
      return { message: 'Performance monitoring is only active on mobile devices' };
    }

    const recentResponseTimes = current.responseTime.slice(-20);
    const avgResponseTime = recentResponseTimes.length > 0
      ? recentResponseTimes.reduce((sum, rt) => sum + rt.duration, 0) / recentResponseTimes.length
      : 0;

    const recentMemory = current.memoryUsage.slice(-1)[0];
    const memoryUsagePercent = recentMemory
      ? (recentMemory.used / recentMemory.limit) * 100
      : 0;

    return {
      averageResponseTime: Math.round(avgResponseTime),
      memoryUsagePercent: Math.round(memoryUsagePercent),
      networkType: current.networkSpeed?.effectiveType || 'unknown',
      deviceMemory: current.deviceInfo?.deviceMemory || 'unknown',
      sampleCount: current.responseTime.length,
      isSlowNetwork: current.networkSpeed?.effectiveType === 'slow-2g' || current.networkSpeed?.effectiveType === '2g',
      isLowMemory: memoryUsagePercent > 80,
      recommendations: getRecommendations(avgResponseTime, memoryUsagePercent, current.networkSpeed)
    };
  }, [isMobile]);

  // Get performance recommendations
  const getRecommendations = (avgResponseTime, memoryUsagePercent, networkSpeed) => {
    const recommendations = [];

    if (avgResponseTime > 2000) {
      recommendations.push('Consider reducing the number of simultaneous operations');
    }

    if (memoryUsagePercent > 80) {
      recommendations.push('Memory usage is high - consider clearing caches or reducing data');
    }

    if (networkSpeed?.effectiveType === 'slow-2g' || networkSpeed?.effectiveType === '2g') {
      recommendations.push('Slow network detected - enable data saving mode');
    }

    if (networkSpeed?.saveData) {
      recommendations.push('User has data saver enabled - optimize for minimal data usage');
    }

    return recommendations;
  };

  // Check if performance is acceptable
  const isPerformanceAcceptable = useCallback(() => {
    const summary = getPerformanceSummary();
    return summary.averageResponseTime < 2000 && 
           summary.memoryUsagePercent < 80 && 
           !summary.isSlowNetwork;
  }, [getPerformanceSummary]);

  return {
    metrics,
    startTiming,
    endTiming,
    measureAsync,
    getPerformanceSummary,
    isPerformanceAcceptable,
    isMobile
  };
};

/**
 * Hook for monitoring specific component performance
 */
export const useComponentPerformance = (componentName) => {
  const { measureAsync, startTiming, endTiming } = usePerformanceMonitoring();
  const renderCountRef = useRef(0);
  const mountTimeRef = useRef(null);

  useEffect(() => {
    // Track component mount time
    mountTimeRef.current = performance.now();
    renderCountRef.current = 0;

    return () => {
      // Track component unmount
      if (mountTimeRef.current) {
        const mountDuration = performance.now() - mountTimeRef.current;
        console.debug(`Component ${componentName} was mounted for ${mountDuration}ms`);
      }
    };
  }, [componentName]);

  useEffect(() => {
    // Track render count
    renderCountRef.current += 1;
  });

  const measureRender = useCallback((renderFn) => {
    const startTime = startTiming(`${componentName}_render`);
    const result = renderFn();
    endTiming(`${componentName}_render`);
    return result;
  }, [componentName, startTiming, endTiming]);

  return {
    measureRender,
    measureAsync: (operationName, asyncFn) => 
      measureAsync(`${componentName}_${operationName}`, asyncFn),
    renderCount: renderCountRef.current
  };
};