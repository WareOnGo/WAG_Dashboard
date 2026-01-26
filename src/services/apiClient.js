import axios from 'axios';
import { authConfig } from '../config/auth.js';
import { getStoredToken, removeStoredAuth } from '../utils/tokenStorage.js';
import { isTokenExpired, isValidToken } from '../utils/jwtUtils.js';

/**
 * Authenticated API client with automatic token handling
 */
class ApiClient {
  constructor() {
    // Create axios instance
    this.client = axios.create({
      baseURL: authConfig.api.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
    });

    // Track if we're currently refreshing to prevent loops
    this.isRefreshing = false;
    this.failedQueue = [];

    // Set up interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  /**
   * Set up request interceptor to add authentication headers
   */
  setupRequestInterceptor() {
    this.client.interceptors.request.use(
      (config) => {
        try {
          // Get current token
          const token = getStoredToken();
          
          // Add authorization header if we have a valid token
          if (token && isValidToken(token)) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Add request timestamp for debugging
          config.metadata = { startTime: Date.now() };

          return config;
        } catch (error) {
          console.error('Error in request interceptor:', error);
          return config;
        }
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set up response interceptor to handle authentication errors and token refresh
   */
  setupResponseInterceptor() {
    this.client.interceptors.response.use(
      (response) => {
        // Add response time for debugging
        if (response.config.metadata) {
          response.config.metadata.endTime = Date.now();
          response.config.metadata.duration = 
            response.config.metadata.endTime - response.config.metadata.startTime;
        }

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Handle network errors
        if (!error.response) {
          error.message = 'Network error - please check your connection and try again';
          return Promise.reject(error);
        }

        const { status } = error.response;

        // Handle 401 Unauthorized responses
        if (status === 401 && !originalRequest._retry) {
          // Mark request as retried to prevent infinite loops
          originalRequest._retry = true;

          // If we're already refreshing, queue this request
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject, originalRequest });
            });
          }

          // Try to refresh token
          try {
            this.isRefreshing = true;
            
            const token = getStoredToken();
            
            // If no token or token is expired, redirect to login
            if (!token || isTokenExpired(token)) {
              this.handleAuthenticationFailure();
              return Promise.reject(new Error('Authentication required'));
            }

            // Attempt token refresh
            const newToken = await this.refreshToken(token);
            
            if (newToken) {
              // Update original request with new token
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              
              // Process queued requests
              this.processQueue(null, newToken);
              
              // Retry original request
              return this.client(originalRequest);
            } else {
              throw new Error('Token refresh failed');
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            
            // Process queued requests with error
            this.processQueue(refreshError, null);
            
            // Handle authentication failure
            this.handleAuthenticationFailure();
            
            return Promise.reject(new Error('Authentication expired - please sign in again'));
          } finally {
            this.isRefreshing = false;
          }
        }

        // Handle other HTTP errors with user-friendly messages
        this.enhanceErrorMessage(error);
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Refresh authentication token
   * @returns {Promise<string|null>} New token or null if refresh failed
   */
  async refreshToken() {
    try {
      // Import authService dynamically to avoid circular dependency
      const { authService } = await import('./authService.js');
      
      const newToken = await authService.refreshToken();
      return newToken;
    } catch (error) {
      console.error('Token refresh failed in API client:', error);
      return null;
    }
  }

  /**
   * Process queued requests after token refresh
   * @param {Error|null} error - Error if refresh failed
   * @param {string|null} token - New token if refresh succeeded
   */
  processQueue(error, token = null) {
    this.failedQueue.forEach(({ resolve, reject, originalRequest }) => {
      if (error) {
        reject(error);
      } else {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        resolve(this.client(originalRequest));
      }
    });
    
    this.failedQueue = [];
  }

  /**
   * Handle authentication failure by cleaning up and redirecting
   */
  handleAuthenticationFailure() {
    try {
      // Clean up stored authentication data
      removeStoredAuth();
      
      // Redirect to sign-in page if we're not already there
      if (window.location.pathname !== '/signin' && window.location.pathname !== '/') {
        window.location.href = '/signin';
      }
    } catch (error) {
      console.error('Error handling authentication failure:', error);
    }
  }

  /**
   * Enhance error messages for better user experience
   * @param {Error} error - Axios error object
   */
  enhanceErrorMessage(error) {
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        error.message = data?.error || 'Invalid request data';
        error.issues = data?.issues || [];
        break;
      case 401:
        error.message = 'Authentication required - please sign in';
        break;
      case 403:
        if (data?.error === 'DOMAIN_RESTRICTED') {
          error.message = 'Access restricted to @wareongo.com accounts';
        } else {
          error.message = 'Access forbidden - insufficient permissions';
        }
        break;
      case 404:
        error.message = data?.error || 'Resource not found';
        break;
      case 409:
        error.message = data?.error || 'Conflict - resource already exists';
        break;
      case 422:
        error.message = data?.error || 'Validation failed';
        error.issues = data?.issues || [];
        break;
      case 429:
        error.message = 'Too many requests - please try again later';
        break;
      case 500:
        error.message = 'Internal server error - please try again later';
        break;
      case 502:
      case 503:
      case 504:
        error.message = 'Service temporarily unavailable - please try again later';
        break;
      default:
        error.message = data?.error || `Server error (${status})`;
    }
  }

  /**
   * Make authenticated GET request
   * @param {string} url - Request URL
   * @param {object} config - Axios config options
   * @returns {Promise} Response data
   */
  async get(url, config = {}) {
    const response = await this.client.get(url, config);
    return response.data;
  }

  /**
   * Make authenticated POST request
   * @param {string} url - Request URL
   * @param {object} data - Request data
   * @param {object} config - Axios config options
   * @returns {Promise} Response data
   */
  async post(url, data = {}, config = {}) {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Make authenticated PUT request
   * @param {string} url - Request URL
   * @param {object} data - Request data
   * @param {object} config - Axios config options
   * @returns {Promise} Response data
   */
  async put(url, data = {}, config = {}) {
    const response = await this.client.put(url, data, config);
    return response.data;
  }

  /**
   * Make authenticated PATCH request
   * @param {string} url - Request URL
   * @param {object} data - Request data
   * @param {object} config - Axios config options
   * @returns {Promise} Response data
   */
  async patch(url, data = {}, config = {}) {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  /**
   * Make authenticated DELETE request
   * @param {string} url - Request URL
   * @param {object} config - Axios config options
   * @returns {Promise} Response data
   */
  async delete(url, config = {}) {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  /**
   * Make request without authentication (for public endpoints)
   * @param {object} config - Axios config
   * @returns {Promise} Response
   */
  async request(config) {
    return this.client.request(config);
  }

  /**
   * Upload file with progress tracking
   * @param {string} url - Upload URL
   * @param {FormData|File} data - File data
   * @param {object} options - Upload options
   * @returns {Promise} Upload response
   */
  async upload(url, data, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...options,
    };

    // Add progress tracking if callback provided
    if (options.onUploadProgress) {
      config.onUploadProgress = options.onUploadProgress;
    }

    const response = await this.client.post(url, data, config);
    return response.data;
  }

  /**
   * Download file with progress tracking
   * @param {string} url - Download URL
   * @param {object} options - Download options
   * @returns {Promise} Download response
   */
  async download(url, options = {}) {
    const config = {
      responseType: 'blob',
      ...options,
    };

    // Add progress tracking if callback provided
    if (options.onDownloadProgress) {
      config.onDownloadProgress = options.onDownloadProgress;
    }

    return this.client.get(url, config);
  }

  /**
   * Get the underlying axios instance for advanced usage
   * @returns {object} Axios instance
   */
  getAxiosInstance() {
    return this.client;
  }

  /**
   * Set default headers for all requests
   * @param {object} headers - Headers to set
   */
  setDefaultHeaders(headers) {
    Object.assign(this.client.defaults.headers, headers);
  }

  /**
   * Set request timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.client.defaults.timeout = timeout;
  }

  /**
   * Add request interceptor
   * @param {function} onFulfilled - Success handler
   * @param {function} onRejected - Error handler
   * @returns {number} Interceptor ID
   */
  addRequestInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  /**
   * Add response interceptor
   * @param {function} onFulfilled - Success handler
   * @param {function} onRejected - Error handler
   * @returns {number} Interceptor ID
   */
  addResponseInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  /**
   * Remove request interceptor
   * @param {number} interceptorId - Interceptor ID to remove
   */
  removeRequestInterceptor(interceptorId) {
    this.client.interceptors.request.eject(interceptorId);
  }

  /**
   * Remove response interceptor
   * @param {number} interceptorId - Interceptor ID to remove
   */
  removeResponseInterceptor(interceptorId) {
    this.client.interceptors.response.eject(interceptorId);
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };