import { useContext } from 'react';
import { CompatibilityContext } from '../contexts/CompatibilityContext';

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