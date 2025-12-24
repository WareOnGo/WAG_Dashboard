import { useState, useEffect } from 'react';

/**
 * Device-specific features and limitations handler
 * Manages safe areas, notches, device capabilities, and platform-specific adaptations
 */

/**
 * Detect device safe areas and notches
 * @returns {Object} Safe area information
 */
const detectSafeAreas = () => {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0, hasNotch: false };
  }

  // Get CSS environment variables for safe areas
  const getEnvValue = (property) => {
    const style = getComputedStyle(document.documentElement);
    const value = style.getPropertyValue(`env(${property})`);
    return value ? parseInt(value, 10) : 0;
  };

  const safeAreaTop = getEnvValue('safe-area-inset-top');
  const safeAreaRight = getEnvValue('safe-area-inset-right');
  const safeAreaBottom = getEnvValue('safe-area-inset-bottom');
  const safeAreaLeft = getEnvValue('safe-area-inset-left');

  // Detect notch presence (typically indicated by safe-area-top > 20px)
  const hasNotch = safeAreaTop > 20;

  return {
    top: safeAreaTop,
    right: safeAreaRight,
    bottom: safeAreaBottom,
    left: safeAreaLeft,
    hasNotch
  };
};

/**
 * Detect device capabilities and limitations
 * @returns {Object} Device capability information
 */
const detectDeviceCapabilities = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const userAgent = navigator.userAgent;
  const screen = window.screen;
  
  return {
    // Screen information
    screenWidth: screen.width,
    screenHeight: screen.height,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
    
    // Device type detection
    isIPhone: /iPhone/.test(userAgent),
    isIPad: /iPad/.test(userAgent),
    isAndroid: /Android/.test(userAgent),
    isTablet: /iPad/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent)),
    
    // Hardware capabilities
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hardwareConcurrency: navigator.hardwareConcurrency || 1,
    deviceMemory: navigator.deviceMemory || 0,
    
    // Network information
    connection: navigator.connection || navigator.mozConnection || navigator.webkitConnection,
    
    // Orientation support
    orientationSupport: 'orientation' in window || 'onorientationchange' in window,
    
    // Vibration support
    vibrationSupport: 'vibrate' in navigator,
    
    // Battery API support
    batterySupport: 'getBattery' in navigator,
    
    // Gamepad support
    gamepadSupport: 'getGamepads' in navigator,
    
    // Camera/Media support
    mediaDevicesSupport: 'mediaDevices' in navigator,
    getUserMediaSupport: 'getUserMedia' in navigator || 'webkitGetUserMedia' in navigator || 'mozGetUserMedia' in navigator,
    
    // Sensors
    accelerometerSupport: 'DeviceMotionEvent' in window,
    gyroscopeSupport: 'DeviceOrientationEvent' in window,
    
    // Platform-specific features
    standalone: window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches,
    
    // Performance characteristics
    isLowEndDevice: (() => {
      const memory = navigator.deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;
      return memory <= 2 || cores <= 2;
    })()
  };
};

/**
 * Get platform-specific CSS variables and styles
 * @param {Object} safeAreas - Safe area information
 * @param {Object} capabilities - Device capabilities
 * @returns {Object} Platform-specific styles
 */
const getPlatformStyles = (safeAreas, capabilities) => {
  const styles = {
    // Safe area CSS custom properties
    '--safe-area-inset-top': `${safeAreas.top}px`,
    '--safe-area-inset-right': `${safeAreas.right}px`,
    '--safe-area-inset-bottom': `${safeAreas.bottom}px`,
    '--safe-area-inset-left': `${safeAreas.left}px`,
    
    // Device-specific adjustments
    '--device-pixel-ratio': capabilities.pixelRatio,
    '--max-touch-points': capabilities.maxTouchPoints,
    
    // Platform-specific properties
    '--platform-padding-top': safeAreas.hasNotch ? `${safeAreas.top + 8}px` : '8px',
    '--platform-padding-bottom': `${Math.max(safeAreas.bottom, 8)}px`,
    
    // Performance-based adjustments
    '--animation-duration': capabilities.isLowEndDevice ? '0.2s' : '0.3s',
    '--transition-duration': capabilities.isLowEndDevice ? '0.15s' : '0.25s'
  };

  // iOS-specific styles
  if (capabilities.isIPhone || capabilities.isIPad) {
    styles['--ios-bounce-behavior'] = 'none';
    styles['--webkit-overflow-scrolling'] = 'touch';
    styles['--webkit-tap-highlight-color'] = 'transparent';
  }

  // Android-specific styles
  if (capabilities.isAndroid) {
    styles['--android-overscroll-behavior'] = 'contain';
    styles['--touch-action'] = 'manipulation';
  }

  return styles;
};

/**
 * Apply device-specific viewport meta tag adjustments
 * @param {Object} capabilities - Device capabilities
 */
const applyViewportAdjustments = (capabilities) => {
  if (typeof document === 'undefined') return;

  let viewportContent = 'width=device-width, initial-scale=1.0';

  // iOS-specific viewport adjustments
  if (capabilities.isIPhone || capabilities.isIPad) {
    viewportContent += ', viewport-fit=cover, user-scalable=no';
  }

  // Android-specific adjustments
  if (capabilities.isAndroid) {
    viewportContent += ', minimum-scale=1.0, maximum-scale=5.0';
  }

  // High DPI adjustments
  if (capabilities.pixelRatio > 2) {
    viewportContent += ', target-densitydpi=device-dpi';
  }

  // Update or create viewport meta tag
  let viewportMeta = document.querySelector('meta[name="viewport"]');
  if (!viewportMeta) {
    viewportMeta = document.createElement('meta');
    viewportMeta.name = 'viewport';
    document.head.appendChild(viewportMeta);
  }
  viewportMeta.content = viewportContent;
};

/**
 * Handle device orientation changes
 * @param {Function} callback - Callback function to execute on orientation change
 * @returns {Function} Cleanup function
 */
const handleOrientationChange = (callback) => {
  if (typeof window === 'undefined') return () => {};

  const handleChange = () => {
    // Use timeout to ensure dimensions are updated after orientation change
    setTimeout(() => {
      const orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      const angle = window.screen?.orientation?.angle || window.orientation || 0;
      
      callback({
        orientation,
        angle,
        width: window.innerWidth,
        height: window.innerHeight
      });
    }, 100);
  };

  // Listen for orientation change events
  window.addEventListener('orientationchange', handleChange);
  window.addEventListener('resize', handleChange);

  // Return cleanup function
  return () => {
    window.removeEventListener('orientationchange', handleChange);
    window.removeEventListener('resize', handleChange);
  };
};

/**
 * Custom hook for device-specific features and limitations
 * @returns {Object} Device features and utilities
 */
export const useDeviceFeatures = () => {
  const [safeAreas, _setSafeAreas] = useState(() => detectSafeAreas());
  const [capabilities, _setCapabilities] = useState(() => detectDeviceCapabilities());
  const [orientation, setOrientation] = useState(() => ({
    orientation: typeof window !== 'undefined' 
      ? (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait')
      : 'portrait',
    angle: 0,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  useEffect(() => {
    // Apply viewport adjustments
    applyViewportAdjustments(capabilities);

    // Set up orientation change handling
    const cleanupOrientation = handleOrientationChange(setOrientation);

    // Apply platform-specific CSS variables
    const platformStyles = getPlatformStyles(safeAreas, capabilities);
    Object.entries(platformStyles).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value);
    });

    // Cleanup function
    return () => {
      cleanupOrientation();
    };
  }, [capabilities, safeAreas]); // Empty dependency array to run only once

  /**
   * Check if device has specific capability
   * @param {string} capability - Capability name to check
   * @returns {boolean} Whether device has the capability
   */
  const hasCapability = (capability) => {
    return capabilities[capability] || false;
  };

  /**
   * Get safe area aware padding for components
   * @param {string} side - Side to get padding for ('top', 'right', 'bottom', 'left', 'all')
   * @returns {string|Object} CSS padding value(s)
   */
  const getSafeAreaPadding = (side = 'all') => {
    const padding = {
      top: `max(${safeAreas.top}px, 8px)`,
      right: `max(${safeAreas.right}px, 8px)`,
      bottom: `max(${safeAreas.bottom}px, 8px)`,
      left: `max(${safeAreas.left}px, 8px)`
    };

    if (side === 'all') {
      return padding;
    }

    return padding[side] || '8px';
  };

  /**
   * Get device-specific CSS classes
   * @returns {string} CSS class names for device-specific styling
   */
  const getDeviceClasses = () => {
    const classes = [
      capabilities.isIPhone ? 'device-iphone' : '',
      capabilities.isIPad ? 'device-ipad' : '',
      capabilities.isAndroid ? 'device-android' : '',
      capabilities.isTablet ? 'device-tablet' : 'device-phone',
      safeAreas.hasNotch ? 'has-notch' : 'no-notch',
      capabilities.isLowEndDevice ? 'low-end-device' : 'high-end-device',
      capabilities.standalone ? 'standalone-app' : 'browser-app',
      `orientation-${orientation.orientation}`,
      `pixel-ratio-${Math.floor(capabilities.pixelRatio)}`
    ].filter(Boolean);

    return classes.join(' ');
  };

  /**
   * Optimize performance based on device capabilities
   * @returns {Object} Performance optimization settings
   */
  const getPerformanceSettings = () => {
    return {
      enableAnimations: !capabilities.isLowEndDevice,
      lazyLoadThreshold: capabilities.isLowEndDevice ? 0.1 : 0.3,
      imageQuality: capabilities.isLowEndDevice ? 0.7 : 0.9,
      maxConcurrentRequests: capabilities.isLowEndDevice ? 2 : 6,
      enableVirtualization: capabilities.deviceMemory > 2,
      enableServiceWorker: !capabilities.isLowEndDevice && 'serviceWorker' in navigator,
      cacheStrategy: capabilities.isLowEndDevice ? 'minimal' : 'aggressive'
    };
  };

  /**
   * Handle device-specific touch interactions
   * @param {HTMLElement} element - Element to optimize for touch
   */
  const optimizeForTouch = (element) => {
    if (!element || !capabilities.maxTouchPoints) return;

    // Prevent zoom on double tap for iOS
    if (capabilities.isIPhone || capabilities.isIPad) {
      element.style.touchAction = 'manipulation';
    }

    // Optimize scrolling for Android
    if (capabilities.isAndroid) {
      element.style.overscrollBehavior = 'contain';
    }

    // Add touch-friendly sizing
    const computedStyle = getComputedStyle(element);
    const minSize = 44; // Minimum touch target size
    
    if (parseInt(computedStyle.minHeight, 10) < minSize) {
      element.style.minHeight = `${minSize}px`;
    }
    if (parseInt(computedStyle.minWidth, 10) < minSize) {
      element.style.minWidth = `${minSize}px`;
    }
  };

  return {
    safeAreas,
    capabilities,
    orientation,
    hasCapability,
    getSafeAreaPadding,
    getDeviceClasses,
    getPerformanceSettings,
    optimizeForTouch,
    platformStyles: getPlatformStyles(safeAreas, capabilities)
  };
};

/**
 * Utility function to add device classes to document
 * @param {Object} deviceFeatures - Device features object from hook
 */
export const addDeviceClasses = (deviceFeatures) => {
  if (typeof document !== 'undefined') {
    const classes = deviceFeatures.getDeviceClasses();
    document.documentElement.className += ` ${classes}`;
  }
};

/**
 * Check if device requires special handling
 * @returns {boolean} Whether device needs special adaptations
 */
export const requiresSpecialHandling = () => {
  const capabilities = detectDeviceCapabilities();
  const safeAreas = detectSafeAreas();
  
  return (
    safeAreas.hasNotch ||
    capabilities.isLowEndDevice ||
    capabilities.pixelRatio > 2 ||
    capabilities.maxTouchPoints > 5
  );
};

export default useDeviceFeatures;