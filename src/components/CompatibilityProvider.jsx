import React, { useEffect } from 'react';
import { CompatibilityContext } from '../contexts/CompatibilityContext';
import { useBrowserCompatibility, addBrowserClasses } from '../hooks/useBrowserCompatibility';
import { useDeviceFeatures, addDeviceClasses } from '../hooks/useDeviceFeatures';

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
    if (import.meta.env.DEV) {
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
  }, [browserCompatibility, deviceFeatures]); // Run only once on mount

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

export default CompatibilityProvider;