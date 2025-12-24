import React, { createContext, useContext, useEffect } from 'react';
import { useBrowserCompatibility, addBrowserClasses } from '../hooks/useBrowserCompatibility';
import { useDeviceFeatures, addDeviceClasses } from '../hooks/useDeviceFeatures';

/**
 * Compatibility Context for sharing browser and device information
 */
const CompatibilityContext = createContext(null);

/**
 * Hook to access compatibility information
 * @returns {Object} Combined browser and device compatibility information
 */
export const useCompatibility = () => {
  const context = useContext(CompatibilityContext);
  if (!context) {
    throw new Error('useCompatibility must be used within a CompatibilityProvider');
  }
  return context;
};

/**
 * Compatibility Provider Component
 * Provides browser and device compatibility information to the entire app
 * Automatically applies necessary classes and polyfills
 */
export const CompatibilityProvider = ({ children }) => {
  const browserCompatibility = useBrowserCompatibility();
  const deviceFeatures = useDeviceFeatures();

  useEffect(() => {
    // Apply browser-specific classes to document
    addBrowserClasses(browserCompatibility);
    
    // Apply device-specific classes to document
    addDeviceClasses(deviceFeatures);
    
    // Apply polyfills for unsupported features
    browserCompatibility.applyPolyfills();
    
    // Only log critical compatibility issues, not general info
    if (process.env.NODE_ENV === 'development') {
      // Only log if there are actual compatibility issues
      if (!browserCompatibility.isSupported) {
        console.warn('⚠️ Browser compatibility issues detected');
      }
      
      // Log device-specific issues that might affect functionality
      if (deviceFeatures.capabilities?.isLowEndDevice) {
        console.info('📱 Low-end device detected - performance optimizations active');
      }
    }
    
    // Show unsupported browser warning if needed
    if (!browserCompatibility.isSupported) {
      console.warn(
        '⚠️ Your browser may not support all features. ' +
        'Please update to a modern browser for the best experience.'
      );
      
      // Optionally show user notification
      if (typeof window !== 'undefined' && window.confirm) {
        const shouldUpdate = window.confirm(
          'Your browser may not support all features of this application. ' +
          'Would you like to continue anyway?'
        );
        
        if (!shouldUpdate) {
          // Redirect to browser update page or show fallback UI
          window.location.href = '/browser-update.html';
        }
      }
    }
  }, []); // Run only once on mount

  // Combine all compatibility information
  const compatibilityInfo = {
    // Browser information
    browser: browserCompatibility.browserInfo,
    features: browserCompatibility.features,
    isSupported: browserCompatibility.isSupported,
    isFeatureSupported: browserCompatibility.isFeatureSupported,
    getFeatureValue: browserCompatibility.getFeatureValue,
    getBrowserClasses: browserCompatibility.getBrowserClasses,
    getBrowserSpecificStyles: browserCompatibility.getBrowserSpecificStyles,
    
    // Device information
    device: deviceFeatures.capabilities,
    safeAreas: deviceFeatures.safeAreas,
    orientation: deviceFeatures.orientation,
    hasCapability: deviceFeatures.hasCapability,
    getSafeAreaPadding: deviceFeatures.getSafeAreaPadding,
    getDeviceClasses: deviceFeatures.getDeviceClasses,
    getPerformanceSettings: deviceFeatures.getPerformanceSettings,
    optimizeForTouch: deviceFeatures.optimizeForTouch,
    platformStyles: deviceFeatures.platformStyles,
    
    // Combined utilities
    isMobileDevice: deviceFeatures.capabilities.isAndroid || 
                   deviceFeatures.capabilities.isIPhone || 
                   deviceFeatures.capabilities.isIPad,
    isLowEndDevice: deviceFeatures.capabilities.isLowEndDevice,
    hasNotch: deviceFeatures.safeAreas.hasNotch,
    isStandalone: deviceFeatures.capabilities.standalone,
    
    // Performance optimization helpers
    shouldUseReducedAnimations: () => {
      return deviceFeatures.capabilities.isLowEndDevice || 
             browserCompatibility.features.reducedMotion;
    },
    
    shouldUseLazyLoading: () => {
      return browserCompatibility.isFeatureSupported('intersectionObserver');
    },
    
    shouldUseServiceWorker: () => {
      return browserCompatibility.isFeatureSupported('serviceWorker') && 
             !deviceFeatures.capabilities.isLowEndDevice;
    },
    
    getOptimalImageFormat: () => {
      if (browserCompatibility.isFeatureSupported('webp')) {
        return 'webp';
      }
      return 'jpg';
    },
    
    // Touch optimization helpers
    getTouchTargetSize: () => {
      const baseSize = 44; // Minimum accessibility requirement
      const deviceMultiplier = deviceFeatures.capabilities.pixelRatio > 2 ? 1.2 : 1;
      return Math.round(baseSize * deviceMultiplier);
    },
    
    // Network optimization helpers
    getConnectionInfo: () => {
      const connection = deviceFeatures.capabilities.connection;
      if (!connection) return { type: 'unknown', speed: 'unknown' };
      
      return {
        type: connection.effectiveType || 'unknown',
        speed: connection.downlink || 0,
        saveData: connection.saveData || false
      };
    }
  };

  return (
    <CompatibilityContext.Provider value={compatibilityInfo}>
      {children}
    </CompatibilityContext.Provider>
  );
};

/**
 * Higher-order component for compatibility-aware components
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Enhanced component with compatibility props
 */
export const withCompatibility = (WrappedComponent) => {
  const CompatibilityEnhancedComponent = (props) => {
    const compatibility = useCompatibility();
    
    return (
      <WrappedComponent 
        {...props} 
        compatibility={compatibility}
      />
    );
  };
  
  CompatibilityEnhancedComponent.displayName = 
    `withCompatibility(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return CompatibilityEnhancedComponent;
};

/**
 * Conditional rendering component based on feature support
 */
export const FeatureGate = ({ 
  feature, 
  fallback = null, 
  children, 
  requireAll = false 
}) => {
  const { isFeatureSupported } = useCompatibility();
  
  const features = Array.isArray(feature) ? feature : [feature];
  const isSupported = requireAll 
    ? features.every(f => isFeatureSupported(f))
    : features.some(f => isFeatureSupported(f));
  
  return isSupported ? children : fallback;
};

/**
 * Browser-specific rendering component
 */
export const BrowserGate = ({ 
  browsers, 
  fallback = null, 
  children, 
  minVersions = {} 
}) => {
  const { browser } = useCompatibility();
  
  const supportedBrowsers = Array.isArray(browsers) ? browsers : [browsers];
  const isSupportedBrowser = supportedBrowsers.includes(browser.name);
  
  let meetsVersionRequirement = true;
  if (minVersions[browser.name]) {
    const currentVersion = parseInt(browser.version, 10);
    const minVersion = minVersions[browser.name];
    meetsVersionRequirement = currentVersion >= minVersion;
  }
  
  const isSupported = isSupportedBrowser && meetsVersionRequirement;
  
  return isSupported ? children : fallback;
};

/**
 * Device-specific rendering component
 */
export const DeviceGate = ({ 
  devices, 
  fallback = null, 
  children 
}) => {
  const { device } = useCompatibility();
  
  const supportedDevices = Array.isArray(devices) ? devices : [devices];
  
  const isSupported = supportedDevices.some(deviceType => {
    switch (deviceType) {
      case 'mobile':
        return device.isAndroid || device.isIPhone;
      case 'tablet':
        return device.isTablet;
      case 'ios':
        return device.isIOS;
      case 'android':
        return device.isAndroid;
      case 'desktop':
        return !device.isMobile;
      default:
        return false;
    }
  });
  
  return isSupported ? children : fallback;
};

export default CompatibilityProvider;