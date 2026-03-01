/**
 * Image Download Utilities
 * Handles bulk downloading of warehouse images
 */

/**
 * Detect if the current browser is a mobile browser
 * @returns {boolean} True if mobile browser detected
 */
export const isMobileBrowser = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check for mobile user agents
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
  
  // Check for touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check for small screen size
  const isSmallScreen = window.innerWidth < 768;
  
  return isMobileUA || (hasTouch && isSmallScreen);
};

/**
 * Detect if the browser is iOS Safari
 * @returns {boolean} True if iOS Safari detected
 */
export const isIOSSafari = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
  
  return isIOS && isSafari;
};

/**
 * Generate filename for downloaded image
 * @param {number} warehouseId - Warehouse ID
 * @param {number} index - Image index (1-based)
 * @param {string} imageUrl - Original image URL
 * @returns {string} Generated filename
 */
export const generateFilename = (warehouseId, index, imageUrl) => {
  try {
    // Extract extension from URL (remove query params first)
    const urlWithoutParams = imageUrl.split('?')[0];
    const urlParts = urlWithoutParams.split('.');
    const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1] : 'jpg';
    
    // Sanitize extension to prevent injection
    const sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const finalExtension = sanitizedExtension || 'jpg';
    
    // Generate filename: warehouse-{id}-image-{index}.{ext}
    return `warehouse-${warehouseId}-image-${index}.${finalExtension}`;
  } catch {
    // Fallback to default naming
    return `warehouse-${warehouseId}-image-${index}.jpg`;
  }
};

/**
 * Download a single image
 * @param {string} imageUrl - Image URL to download
 * @param {string} filename - Desired filename
 * @returns {Promise<boolean>} Success status
 */
export const downloadSingleImage = async (imageUrl, filename) => {
  try {
    // Validate URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Invalid image URL');
    }

    // Fetch image as blob
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    
    // Verify it's an image
    if (!blob.type.startsWith('image/')) {
      throw new Error('Downloaded content is not an image');
    }

    // Create temporary download link
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    link.style.display = 'none';
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    
    // Revoke blob URL after a short delay to ensure download starts
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
    
    return true;
  } catch (error) {
    // Re-throw with context
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error: Unable to fetch image');
    } else if (error.message.includes('CORS')) {
      throw new Error('CORS error: Image cannot be downloaded due to security restrictions');
    } else {
      throw error;
    }
  }
};

/**
 * Download all images from a warehouse
 * @param {Array<string>} imageUrls - Array of image URLs
 * @param {number} warehouseId - Warehouse ID for filename generation
 * @param {number} delayMs - Delay between downloads in milliseconds (default: 500)
 * @returns {Promise<Object>} Download results with success/failure counts
 */
export const downloadAllImages = async (imageUrls, warehouseId, delayMs = 500) => {
  const results = {
    total: imageUrls.length,
    successful: 0,
    failed: 0,
    errors: [],
    usedFallback: false
  };

  // Validate inputs
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error('No images to download');
  }

  if (!warehouseId) {
    throw new Error('Warehouse ID is required');
  }

  // Check if we're on a mobile browser that might block multiple downloads
  const isMobile = isMobileBrowser();
  const isIOS = isIOSSafari();
  
  // For iOS Safari or mobile browsers with multiple images, use fallback approach
  if ((isIOS || isMobile) && imageUrls.length > 3) {
    return await downloadImagesWithFallback(imageUrls, warehouseId);
  }

  // Process each image with standard download approach
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const filename = generateFilename(warehouseId, i + 1, imageUrl);
    
    try {
      await downloadSingleImage(imageUrl, filename);
      results.successful++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        url: imageUrl,
        error: error.message,
        index: i + 1
      });
    }
    
    // Add delay between downloads to prevent browser blocking
    // Skip delay after the last image
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

/**
 * Fallback download method for mobile browsers
 * Opens images in new tabs when direct download is blocked
 * @param {Array<string>} imageUrls - Array of image URLs
 * @param {number} warehouseId - Warehouse ID
 * @returns {Promise<Object>} Download results
 */
const downloadImagesWithFallback = async (imageUrls, warehouseId) => {
  const results = {
    total: imageUrls.length,
    successful: 0,
    failed: 0,
    errors: [],
    usedFallback: true
  };

  // Try to download first few images normally
  const directDownloadLimit = 3;
  const directDownloadUrls = imageUrls.slice(0, directDownloadLimit);
  const fallbackUrls = imageUrls.slice(directDownloadLimit);

  // Download first few images directly
  for (let i = 0; i < directDownloadUrls.length; i++) {
    const imageUrl = directDownloadUrls[i];
    const filename = generateFilename(warehouseId, i + 1, imageUrl);
    
    try {
      await downloadSingleImage(imageUrl, filename);
      results.successful++;
      
      // Add delay between downloads
      if (i < directDownloadUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        url: imageUrl,
        error: error.message,
        index: i + 1
      });
    }
  }

  // For remaining images, open in new tabs (mobile fallback)
  if (fallbackUrls.length > 0) {
    // Add a small delay before opening tabs
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    fallbackUrls.forEach((imageUrl, idx) => {
      try {
        // Open image in new tab with noopener for security
        const newWindow = window.open(imageUrl, '_blank', 'noopener,noreferrer');
        if (newWindow) {
          results.successful++;
        } else {
          throw new Error('Popup blocked');
        }
      } catch {
        results.failed++;
        results.errors.push({
          url: imageUrl,
          error: 'Could not open image in new tab',
          index: directDownloadLimit + idx + 1
        });
      }
    });
  }

  return results;
};

/**
 * Error message constants
 */
export const ERROR_MESSAGES = {
  NO_IMAGES: 'No images available to download',
  PARTIAL_FAILURE: (successful, total, failed) => 
    `Downloaded ${successful} of ${total} images. ${failed} failed.`,
  COMPLETE_FAILURE: 'Failed to download images. Please try again.',
  CORS_ERROR: 'Some images could not be downloaded due to security restrictions.',
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  MOBILE_FALLBACK: 'On mobile devices, some images will open in new tabs instead of downloading directly. You can save them from there.'
};
