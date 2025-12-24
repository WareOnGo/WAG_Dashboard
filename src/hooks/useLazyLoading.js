import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for implementing lazy loading with Intersection Observer
 * 
 * Provides:
 * - Intersection Observer-based lazy loading
 * - Configurable root margin and threshold
 * - Loading state management
 * - Performance optimizations for mobile devices
 */
export const useLazyLoading = (options = {}) => {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    triggerOnce = true,
    enabled = true
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef(null);
  const observerRef = useRef(null);

  const observe = useCallback(() => {
    if (!enabled || !elementRef.current || hasLoaded) return;

    // Check if Intersection Observer is supported
    if (!window.IntersectionObserver) {
      setIsIntersecting(true);
      setHasLoaded(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          
          if (triggerOnce) {
            setHasLoaded(true);
            observerRef.current?.disconnect();
          }
        } else if (!triggerOnce) {
          setIsIntersecting(false);
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    observerRef.current.observe(elementRef.current);
  }, [enabled, hasLoaded, rootMargin, threshold, triggerOnce]);

  useEffect(() => {
    observe();

    return () => {
      observerRef.current?.disconnect();
    };
  }, [observe]);

  const reset = useCallback(() => {
    setIsIntersecting(false);
    setHasLoaded(false);
    observe();
  }, [observe]);

  return {
    elementRef,
    isIntersecting,
    hasLoaded,
    reset
  };
};

/**
 * Hook for lazy loading images with fallback support
 */
export const useLazyImage = (src, options = {}) => {
  const { placeholder, onLoad, onError } = options;
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [imageStatus, setImageStatus] = useState('loading');
  const { elementRef, isIntersecting } = useLazyLoading(options);

  useEffect(() => {
    if (!isIntersecting || !src) return;

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setImageStatus('loaded');
      onLoad?.(img);
    };

    img.onerror = () => {
      setImageStatus('error');
      onError?.(img);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isIntersecting, src, onLoad, onError]);

  return {
    elementRef,
    imageSrc,
    imageStatus,
    isLoading: imageStatus === 'loading',
    hasError: imageStatus === 'error',
    isLoaded: imageStatus === 'loaded'
  };
};

/**
 * Hook for lazy loading components with dynamic imports
 */
export const useLazyComponent = (importFn, options = {}) => {
  const [Component, setComponent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { elementRef, isIntersecting } = useLazyLoading(options);

  useEffect(() => {
    if (!isIntersecting || Component) return;

    setLoading(true);
    setError(null);

    importFn()
      .then((module) => {
        setComponent(() => module.default || module);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [isIntersecting, Component, importFn]);

  return {
    elementRef,
    Component,
    loading,
    error
  };
};