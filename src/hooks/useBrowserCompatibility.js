import { useState, useEffect } from 'react';

/**
 * Browser detection and feature support utility
 * Provides comprehensive browser compatibility and feature detection
 * for mobile optimization across different devices and browsers
 */

/**
 * Detect browser type and version
 * @returns {Object} Browser information
 */
const detectBrowser = () => {
  if (typeof window === 'undefined') {
    return { name: 'unknown', version: '0', isMobile: false };
  }

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  
  // Mobile device detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  
  // Browser detection
  let browserName = 'unknown';
  let browserVersion = '0';
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    browserVersion = match ? match[1] : '0';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'safari';
    const match = userAgent.match(/Version\/(\d+)/);
    browserVersion = match ? match[1] : '0';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    browserVersion = match ? match[1] : '0';
  } else if (userAgent.includes('Edg')) {
    browserName = 'edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    browserVersion = match ? match[1] : '0';
  } else if (userAgent.includes('SamsungBrowser')) {
    browserName = 'samsung';
    const match = userAgent.match(/SamsungBrowser\/(\d+)/);
    browserVersion = match ? match[1] : '0';
  }

  return {
    name: browserName,
    version: browserVersion,
    isMobile,
    isIOS,
    isAndroid,
    platform,
    userAgent
  };
};

/**
 * Feature detection for modern web APIs and CSS features
 * @returns {Object} Feature support information
 */
const detectFeatures = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const features = {
    // CSS Features
    cssGrid: CSS.supports('display', 'grid'),
    cssFlexbox: CSS.supports('display', 'flex'),
    cssCustomProperties: CSS.supports('--test', 'value'),
    cssViewportUnits: CSS.supports('width', '100vw'),
    cssClamp: CSS.supports('width', 'clamp(1rem, 2vw, 3rem)'),
    cssLogicalProperties: CSS.supports('margin-inline-start', '1rem'),
    
    // JavaScript APIs
    intersectionObserver: 'IntersectionObserver' in window,
    resizeObserver: 'ResizeObserver' in window,
    mutationObserver: 'MutationObserver' in window,
    
    // Touch and Pointer Events
    touchEvents: 'ontouchstart' in window,
    pointerEvents: 'onpointerdown' in window,
    
    // Storage APIs
    localStorage: (() => {
      try {
        return 'localStorage' in window && window.localStorage !== null;
      } catch {
        return false;
      }
    })(),
    sessionStorage: (() => {
      try {
        return 'sessionStorage' in window && window.sessionStorage !== null;
      } catch {
        return false;
      }
    })(),
    
    // Network APIs
    fetch: 'fetch' in window,
    serviceWorker: 'serviceWorker' in navigator,
    
    // Device APIs
    deviceOrientation: 'DeviceOrientationEvent' in window,
    deviceMotion: 'DeviceMotionEvent' in window,
    geolocation: 'geolocation' in navigator,
    
    // Media APIs
    webp: (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    })(),
    
    // Performance APIs
    performanceObserver: 'PerformanceObserver' in window,
    requestIdleCallback: 'requestIdleCallback' in window,
    
    // Modern JavaScript Features
    es6Modules: 'noModule' in document.createElement('script'),
    asyncAwait: (() => {
      try {
        return (async () => {})().constructor === (async function(){}).constructor;
      } catch {
        return false;
      }
    })(),
    
    // Viewport and Display
    visualViewport: 'visualViewport' in window,
    screenOrientation: 'screen' in window && 'orientation' in window.screen,
    
    // Security Features
    https: window.location.protocol === 'https:',
    
    // Accessibility
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    highContrast: window.matchMedia('(prefers-contrast: high)').matches,
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches
  };

  return features;
};

/**
 * Get browser-specific CSS prefixes and properties
 * @returns {Object} Browser-specific styling information
 */
const getBrowserSpecificStyles = (browserInfo) => {
  const styles = {
    prefix: '',
    scrollbarStyles: {},
    touchAction: 'manipulation',
    userSelect: 'none'
  };

  switch (browserInfo.name) {
    case 'webkit':
    case 'safari':
    case 'chrome':
      styles.prefix = '-webkit-';
      styles.scrollbarStyles = {
        '&::-webkit-scrollbar': {
          width: '8px',
          height: '8px'
        },
        '&::-webkit-scrollbar-track': {
          background: 'var(--color-background-secondary)'
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--color-border)',
          borderRadius: '4px'
        }
      };
      break;
    case 'firefox':
      styles.scrollbarStyles = {
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--color-border) var(--color-background-secondary)'
      };
      break;
    default:
      break;
  }

  // iOS-specific adjustments
  if (browserInfo.isIOS) {
    styles.touchAction = 'manipulation';
    styles.webkitTapHighlightColor = 'transparent';
    styles.webkitTouchCallout = 'none';
  }

  return styles;
};

/**
 * Custom hook for browser compatibility and feature detection
 * @returns {Object} Browser compatibility information and utilities
 */
export const useBrowserCompatibility = () => {
  const [browserInfo, _setBrowserInfo] = useState(() => detectBrowser());
  const [features, _setFeatures] = useState(() => detectFeatures());
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check if browser meets minimum requirements
    const checkSupport = () => {
      const minVersions = {
        chrome: 90,
        safari: 14,
        firefox: 88,
        edge: 90,
        samsung: 14
      };

      const currentVersion = parseInt(browserInfo.version, 10);
      const minVersion = minVersions[browserInfo.name];
      
      if (minVersion && currentVersion < minVersion) {
        setIsSupported(false);
        return false;
      }

      // Check for critical features
      const criticalFeatures = [
        'cssFlexbox',
        'cssCustomProperties',
        'fetch',
        'localStorage'
      ];

      const hasAllCriticalFeatures = criticalFeatures.every(
        feature => features[feature]
      );

      setIsSupported(hasAllCriticalFeatures);
      return hasAllCriticalFeatures;
    };

    checkSupport();
  }, [browserInfo.name, browserInfo.version, features]); // Empty dependency array to run only once

  /**
   * Check if a specific feature is supported
   * @param {string} featureName - Name of the feature to check
   * @returns {boolean} Whether the feature is supported
   */
  const isFeatureSupported = (featureName) => {
    return features[featureName] || false;
  };

  /**
   * Get fallback value for unsupported features
   * @param {string} featureName - Name of the feature
   * @param {*} modernValue - Value to use if feature is supported
   * @param {*} fallbackValue - Value to use if feature is not supported
   * @returns {*} Appropriate value based on feature support
   */
  const getFeatureValue = (featureName, modernValue, fallbackValue) => {
    return isFeatureSupported(featureName) ? modernValue : fallbackValue;
  };

  /**
   * Apply browser-specific polyfills or workarounds
   */
  const applyPolyfills = () => {
    // Only log critical missing features that affect functionality
    const criticalMissing = [];
    
    if (!features.intersectionObserver) {
      criticalMissing.push('IntersectionObserver');
    }
    
    if (!features.cssGrid) {
      criticalMissing.push('CSS Grid');
    }
    
    if (!features.touchEvents && browserInfo.isMobile) {
      criticalMissing.push('Touch Events');
    }
    
    // Only log if there are critical missing features
    if (criticalMissing.length > 0 && import.meta.env.DEV) {
      console.warn(`Missing features: ${criticalMissing.join(', ')}`);
    }
  };

  /**
   * Get browser-specific CSS classes for styling
   * @returns {string} CSS class names for browser-specific styling
   */
  const getBrowserClasses = () => {
    const classes = [
      `browser-${browserInfo.name}`,
      `browser-version-${browserInfo.version}`,
      browserInfo.isMobile ? 'is-mobile' : 'is-desktop',
      browserInfo.isIOS ? 'is-ios' : '',
      browserInfo.isAndroid ? 'is-android' : '',
      isSupported ? 'is-supported' : 'is-unsupported'
    ].filter(Boolean);

    return classes.join(' ');
  };

  return {
    browserInfo,
    features,
    isSupported,
    isFeatureSupported,
    getFeatureValue,
    applyPolyfills,
    getBrowserClasses,
    getBrowserSpecificStyles: () => getBrowserSpecificStyles(browserInfo)
  };
};

/**
 * Utility function to add browser compatibility classes to document
 * @param {Object} browserCompatibility - Browser compatibility object from hook
 */
export const addBrowserClasses = (browserCompatibility) => {
  if (typeof document !== 'undefined') {
    const classes = browserCompatibility.getBrowserClasses();
    document.documentElement.className += ` ${classes}`;
  }
};

/**
 * Check if current environment supports modern features
 * @returns {boolean} Whether environment supports modern web features
 */
export const isModernBrowser = () => {
  const { features: _features, browserInfo: _browserInfo } = detectBrowser();
  const featureSupport = detectFeatures();
  
  const modernFeatures = [
    'cssGrid',
    'cssFlexbox',
    'cssCustomProperties',
    'fetch',
    'intersectionObserver'
  ];

  return modernFeatures.every(feature => featureSupport[feature]);
};

export default useBrowserCompatibility;