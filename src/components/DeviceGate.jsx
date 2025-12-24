import React from 'react';
import { useCompatibility } from '../hooks/useCompatibility';

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

export default DeviceGate;