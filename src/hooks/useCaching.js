import { useState, useEffect, useCallback, useRef } from 'react';
import { useViewport } from './useViewport';

/**
 * Custom hook for intelligent caching strategies optimized for mobile
 * 
 * Provides:
 * - Memory-based caching with size limits
 * - LRU (Least Recently Used) eviction policy
 * - Mobile-optimized cache sizes
 * - Automatic cache cleanup
 */
export const useCache = (options = {}) => {
  const { 
    maxSize = 50, 
    ttl = 300000, // 5 minutes default TTL
    enablePersistence = false 
  } = options;
  
  const { isMobile } = useViewport();
  const cacheRef = useRef(new Map());
  const accessTimeRef = useRef(new Map());
  
  // Adjust cache size for mobile devices
  const effectiveMaxSize = isMobile ? Math.floor(maxSize * 0.6) : maxSize;

  const set = useCallback((key, value) => {
    const cache = cacheRef.current;
    const accessTime = accessTimeRef.current;
    const now = Date.now();

    // If cache is full, remove least recently used item
    if (cache.size >= effectiveMaxSize && !cache.has(key)) {
      let lruKey = null;
      let lruTime = Infinity;

      for (const [k, time] of accessTime.entries()) {
        if (time < lruTime) {
          lruTime = time;
          lruKey = k;
        }
      }

      if (lruKey) {
        cache.delete(lruKey);
        accessTime.delete(lruKey);
      }
    }

    // Store value with timestamp
    cache.set(key, {
      value,
      timestamp: now,
      ttl
    });
    accessTime.set(key, now);

    // Persist to localStorage if enabled and not on mobile (to save storage)
    if (enablePersistence && !isMobile) {
      try {
        localStorage.setItem(`cache_${key}`, JSON.stringify({
          value,
          timestamp: now,
          ttl
        }));
      } catch (error) {
        console.warn('Failed to persist cache item:', error);
      }
    }
  }, [effectiveMaxSize, ttl, enablePersistence, isMobile]);

  const get = useCallback((key) => {
    const cache = cacheRef.current;
    const accessTime = accessTimeRef.current;
    const now = Date.now();

    let item = cache.get(key);

    // If not in memory cache, try to load from localStorage
    if (!item && enablePersistence && !isMobile) {
      try {
        const stored = localStorage.getItem(`cache_${key}`);
        if (stored) {
          item = JSON.parse(stored);
          if (item && now - item.timestamp < item.ttl) {
            cache.set(key, item);
          } else {
            localStorage.removeItem(`cache_${key}`);
            item = null;
          }
        }
      } catch (error) {
        console.warn('Failed to load cache item from localStorage:', error);
      }
    }

    if (!item) return null;

    // Check if item has expired
    if (now - item.timestamp > item.ttl) {
      cache.delete(key);
      accessTime.delete(key);
      
      if (enablePersistence && !isMobile) {
        try {
          localStorage.removeItem(`cache_${key}`);
        } catch (error) {
          console.warn('Failed to remove expired cache item:', error);
        }
      }
      
      return null;
    }

    // Update access time
    accessTime.set(key, now);
    
    return item.value;
  }, [enablePersistence, isMobile]);

  const remove = useCallback((key) => {
    const cache = cacheRef.current;
    const accessTime = accessTimeRef.current;

    cache.delete(key);
    accessTime.delete(key);

    if (enablePersistence && !isMobile) {
      try {
        localStorage.removeItem(`cache_${key}`);
      } catch (error) {
        console.warn('Failed to remove cache item from localStorage:', error);
      }
    }
  }, [enablePersistence, isMobile]);

  const clear = useCallback(() => {
    cacheRef.current.clear();
    accessTimeRef.current.clear();

    if (enablePersistence && !isMobile) {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('cache_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        console.warn('Failed to clear cache from localStorage:', error);
      }
    }
  }, [enablePersistence, isMobile]);

  const has = useCallback((key) => {
    return get(key) !== null;
  }, [get]);

  const size = useCallback(() => {
    return cacheRef.current.size;
  }, []);

  // Cleanup expired items periodically
  useEffect(() => {
    const cleanup = () => {
      const cache = cacheRef.current;
      const accessTime = accessTimeRef.current;
      const now = Date.now();

      for (const [key, item] of cache.entries()) {
        if (now - item.timestamp > item.ttl) {
          cache.delete(key);
          accessTime.delete(key);
          
          if (enablePersistence && !isMobile) {
            try {
              localStorage.removeItem(`cache_${key}`);
            } catch (error) {
              console.warn('Failed to remove expired cache item:', error);
            }
          }
        }
      }
    };

    // Run cleanup every minute
    const interval = setInterval(cleanup, 60000);

    return () => clearInterval(interval);
  }, [enablePersistence, isMobile]);

  return {
    set,
    get,
    remove,
    clear,
    has,
    size,
    maxSize: effectiveMaxSize
  };
};

/**
 * Hook for caching API responses with mobile optimization
 */
export const useApiCache = (options = {}) => {
  const { 
    ttl = 300000, // 5 minutes
    maxSize = 20,
    enableOffline = true 
  } = options;
  
  const { isMobile } = useViewport();
  const cache = useCache({ 
    maxSize: isMobile ? Math.floor(maxSize * 0.5) : maxSize, 
    ttl,
    enablePersistence: enableOffline 
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const cacheApiCall = useCallback(async (key, apiCall, forceRefresh = false) => {
    // Return cached data if available and not forcing refresh
    if (!forceRefresh) {
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }
    }

    // If offline and no cached data, throw error
    if (!isOnline && !cache.has(key)) {
      throw new Error('No cached data available while offline');
    }

    // If offline but have cached data, return it
    if (!isOnline) {
      return cache.get(key);
    }

    try {
      // Make API call
      const result = await apiCall();
      
      // Cache the result
      cache.set(key, result);
      
      return result;
    } catch (error) {
      // If API call fails but we have cached data, return it
      const cached = cache.get(key);
      if (cached) {
        console.warn('API call failed, returning cached data:', error);
        return cached;
      }
      
      throw error;
    }
  }, [cache, isOnline]);

  return {
    cacheApiCall,
    clearCache: cache.clear,
    isOnline,
    isMobile
  };
};