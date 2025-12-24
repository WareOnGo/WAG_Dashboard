import React from 'react';
import { useCompatibility } from '../hooks/useCompatibility';

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

export default BrowserGate;