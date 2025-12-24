import React from 'react';
import { useCompatibility } from '../hooks/useCompatibility';

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

export default FeatureGate;