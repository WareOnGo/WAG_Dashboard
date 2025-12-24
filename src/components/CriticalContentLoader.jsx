import React, { useState, useEffect, Suspense } from 'react';
import { Spin } from 'antd';
import { useViewport } from '../hooks/useViewport';
import performanceService from '../services/performanceService';

/**
 * CriticalContentLoader Component
 * 
 * Optimizes initial loading by prioritizing above-the-fold content:
 * - Renders critical content first
 * - Defers non-critical content loading
 * - Provides loading states for better UX
 * - Optimizes for mobile performance
 */
const CriticalContentLoader = ({ 
  children, 
  fallback = null,
  priority = 'normal',
  defer = false 
}) => {
  const { isMobile } = useViewport();
  const [isReady, setIsReady] = useState(!defer);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (defer) {
      // Use different strategies based on priority
      const loadContent = () => {
        if (priority === 'critical') {
          // Load immediately for critical content
          setIsReady(true);
          setIsVisible(true);
        } else if (priority === 'high') {
          // Load after a short delay
          setTimeout(() => {
            setIsReady(true);
            setIsVisible(true);
          }, 50);
        } else {
          // Load when idle for normal/low priority content
          const scheduleLoad = () => {
            if ('requestIdleCallback' in window) {
              requestIdleCallback(() => {
                setIsReady(true);
                setTimeout(() => setIsVisible(true), 100);
              }, { timeout: 2000 });
            } else {
              setTimeout(() => {
                setIsReady(true);
                setTimeout(() => setIsVisible(true), 100);
              }, priority === 'low' ? 500 : 200);
            }
          };

          // Wait for critical content to load first
          if (document.body.classList.contains('critical-content-ready')) {
            scheduleLoad();
          } else {
            const observer = new MutationObserver(() => {
              if (document.body.classList.contains('critical-content-ready')) {
                scheduleLoad();
                observer.disconnect();
              }
            });
            observer.observe(document.body, { 
              attributes: true, 
              attributeFilter: ['class'] 
            });
          }
        }
      };

      loadContent();
    } else {
      setIsVisible(true);
    }
  }, [defer, priority]);

  // Don't render anything if not ready
  if (!isReady) {
    return fallback;
  }

  // Render with fade-in animation
  return (
    <div 
      className={`critical-content ${isVisible ? 'critical-content--visible' : ''}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        willChange: isVisible ? 'auto' : 'opacity'
      }}
    >
      {children}
    </div>
  );
};

/**
 * AboveFoldOptimizer Component
 * 
 * Wraps the main app content to optimize above-the-fold rendering
 */
export const AboveFoldOptimizer = ({ children }) => {
  const { isMobile } = useViewport();
  const [criticalReady, setCriticalReady] = useState(false);

  useEffect(() => {
    // Prioritize above-the-fold content
    performanceService.prioritizeAboveFold().then(() => {
      setCriticalReady(true);
    });
  }, []);

  return (
    <div className="above-fold-optimizer">
      {/* Critical above-the-fold content */}
      <CriticalContentLoader priority="critical">
        <div className="critical-layout">
          {children}
        </div>
      </CriticalContentLoader>
      
      {/* Performance monitoring indicator (development only) */}
      {process.env.NODE_ENV === 'development' && isMobile && (
        <PerformanceIndicator />
      )}
    </div>
  );
};

/**
 * Performance Indicator Component (Development only)
 */
const PerformanceIndicator = () => {
  const [metrics, setMetrics] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      const currentMetrics = performanceService.getMetrics();
      setMetrics(currentMetrics);
    };

    // Update metrics every 2 seconds
    const interval = setInterval(updateMetrics, 2000);
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  if (!metrics) return null;

  const isGood = metrics.isAcceptable;
  const loadTime = metrics.totalLoadTime;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setVisible(!visible)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isGood ? '#52c41a' : '#ff4d4f',
          color: 'white',
          fontSize: '12px',
          zIndex: 9999,
          cursor: 'pointer'
        }}
      >
        📊
      </button>

      {/* Metrics panel */}
      {visible && (
        <div
          style={{
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '11px',
            zIndex: 9999,
            minWidth: '200px'
          }}
        >
          <div><strong>Performance Metrics</strong></div>
          <div>Status: {isGood ? '✅ Good' : '⚠️ Needs Improvement'}</div>
          {loadTime && <div>Load Time: {Math.round(loadTime)}ms</div>}
          {metrics.firstContentfulPaint && (
            <div>FCP: {Math.round(metrics.firstContentfulPaint)}ms</div>
          )}
          {metrics.largestContentfulPaint && (
            <div>LCP: {Math.round(metrics.largestContentfulPaint)}ms</div>
          )}
          {metrics.firstInputDelay && (
            <div>FID: {Math.round(metrics.firstInputDelay)}ms</div>
          )}
          {metrics.cumulativeLayoutShift && (
            <div>CLS: {metrics.cumulativeLayoutShift.toFixed(3)}</div>
          )}
        </div>
      )}
    </>
  );
};

export default CriticalContentLoader;