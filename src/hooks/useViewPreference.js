import { useState, useEffect } from 'react';
import { useViewport } from './useViewport';

/**
 * Custom hook for managing view preferences with persistence
 * 
 * Handles:
 * - View preference persistence across sessions
 * - Automatic view selection based on screen size
 * - Smooth transitions between view modes
 * - Fallback handling for localStorage issues
 */
export const useViewPreference = (defaultView = 'auto') => {
  const { isMobile } = useViewport();
  const [currentView, setCurrentView] = useState(() => {
    // Initialize with stored preference or auto-detect
    if (typeof window === 'undefined') {
      return isMobile ? 'cards' : 'table';
    }

    try {
      const stored = localStorage.getItem('warehouse-view-preference');
      if (stored && ['table', 'cards'].includes(stored)) {
        return stored;
      }
    } catch (error) {
      console.warn('Failed to read view preference from localStorage:', error);
    }

    // Auto-detect based on screen size if no preference stored
    if (defaultView === 'auto') {
      return isMobile ? 'cards' : 'table';
    }

    return defaultView;
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-switch view when screen size changes (if user hasn't set explicit preference)
  useEffect(() => {
    try {
      const hasExplicitPreference = localStorage.getItem('warehouse-view-preference');
      
      if (!hasExplicitPreference) {
        const recommendedView = isMobile ? 'cards' : 'table';
        if (currentView !== recommendedView) {
          setCurrentView(recommendedView);
        }
      }
    } catch {
      // Fallback to auto-detection if localStorage fails
      const recommendedView = isMobile ? 'cards' : 'table';
      if (currentView !== recommendedView) {
        setCurrentView(recommendedView);
      }
    }
  }, [isMobile, currentView]);

  /**
   * Change the current view with smooth transition
   * @param {string} newView - The view to switch to ('table' or 'cards')
   * @param {boolean} persist - Whether to persist this preference
   */
  const changeView = (newView, persist = true) => {
    if (!['table', 'cards'].includes(newView) || newView === currentView) {
      return;
    }

    setIsTransitioning(true);

    // Smooth transition delay
    setTimeout(() => {
      setCurrentView(newView);
      
      // Persist preference if requested
      if (persist) {
        try {
          localStorage.setItem('warehouse-view-preference', newView);
        } catch (error) {
          console.warn('Failed to save view preference:', error);
        }
      }

      // End transition after a short delay
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    }, 50);
  };

  /**
   * Reset to auto-detection mode
   */
  const resetToAuto = () => {
    try {
      localStorage.removeItem('warehouse-view-preference');
    } catch (error) {
      console.warn('Failed to clear view preference:', error);
    }

    const autoView = isMobile ? 'cards' : 'table';
    changeView(autoView, false);
  };

  /**
   * Get the recommended view for current screen size
   */
  const getRecommendedView = () => {
    return isMobile ? 'cards' : 'table';
  };

  /**
   * Check if current view is the recommended one
   */
  const isRecommendedView = () => {
    return currentView === getRecommendedView();
  };

  /**
   * Check if user has set an explicit preference
   */
  const hasExplicitPreference = () => {
    try {
      return localStorage.getItem('warehouse-view-preference') !== null;
    } catch {
      return false;
    }
  };

  /**
   * Toggle between table and cards view
   */
  const toggleView = () => {
    const newView = currentView === 'table' ? 'cards' : 'table';
    changeView(newView);
  };

  return {
    currentView,
    isTransitioning,
    changeView,
    toggleView,
    resetToAuto,
    getRecommendedView,
    isRecommendedView: isRecommendedView(),
    hasExplicitPreference: hasExplicitPreference(),
    recommendedView: getRecommendedView()
  };
};