import React from 'react';
import { Spin } from 'antd';
import { useLazyImage } from '../hooks/useLazyLoading';
import { useViewport } from '../hooks/useViewport';

/**
 * LazyImage Component
 * 
 * A performance-optimized image component with lazy loading:
 * - Intersection Observer-based lazy loading
 * - Responsive image sizing
 * - Loading states and error handling
 * - Mobile-optimized performance
 */
const LazyImage = ({
  src,
  alt = '',
  placeholder = '',
  className = '',
  style = {},
  width,
  height,
  onLoad,
  onError,
  ...props
}) => {
  const { isMobile } = useViewport();
  
  const {
    elementRef,
    imageSrc,
    imageStatus,
    isLoading,
    hasError,
    isLoaded
  } = useLazyImage(src, {
    placeholder,
    onLoad: (img) => {
      onLoad?.(img);
    },
    onError: (img) => {
      onError?.(img);
    },
    rootMargin: isMobile ? '100px' : '50px',
    threshold: 0.1
  });

  const containerStyle = {
    position: 'relative',
    display: 'inline-block',
    width: width || 'auto',
    height: height || 'auto',
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
    overflow: 'hidden',
    ...style
  };

  const imageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: isLoaded ? 'block' : 'none' // Use display instead of opacity
  };

  // Don't render anything if no valid source
  if (!src || src.length === 0) {
    return null;
  }

  // Debug logging to understand the state
  if (process.env.NODE_ENV === 'development') {
    console.log('LazyImage Debug:', { 
      src: src?.substring(0, 50), 
      isLoading, 
      isLoaded, 
      imageStatus, 
      hasError,
      imageSrc: imageSrc?.substring(0, 50)
    });
  }

  // Only show placeholder when actually loading and image is not loaded yet
  const showPlaceholder = isLoading && !isLoaded;

  return (
    <div 
      ref={elementRef}
      className={`lazy-image ${className}`}
      style={containerStyle}
      {...props}
    >
      {/* Actual image - only render when we have a source */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          style={imageStyle}
          loading="lazy"
        />
      )}
      
      {/* Placeholder/Loading/Error state - only when needed */}
      {(isLoading && !isLoaded && imageStatus !== 'loaded') && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#262626',
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Spin size="small" />
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              Loading...
            </div>
          </div>
        </div>
      )}
      
      {/* Error state */}
      {hasError && !isLoaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#262626',
          color: 'rgba(255, 255, 255, 0.45)',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>📷</div>
            <div>Failed to load</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LazyImage;