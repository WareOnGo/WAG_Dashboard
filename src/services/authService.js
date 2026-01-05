import axios from 'axios';
import { authConfig } from '../config/auth.js';
import { 
  getStoredToken, 
  setStoredToken, 
  getStoredUser, 
  setStoredUser, 
  removeStoredAuth,
  validateStoredAuth 
} from '../utils/tokenStorage.js';
import { 
  isTokenExpired, 
  isTokenExpiringSoon, 
  getUserFromToken, 
  isValidToken 
} from '../utils/jwtUtils.js';

/**
 * Authentication service for handling Google OAuth and JWT token management
 */
class AuthService {
  constructor() {
    this.api = axios.create({
      baseURL: authConfig.api.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    // Track refresh promise to prevent multiple simultaneous refresh attempts
    this.refreshPromise = null;
    
    // Set up automatic token refresh timer
    this.refreshTimer = null;
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // Start with 1 second
      retryMultiplier: 2, // Exponential backoff
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT', 'SERVICE_UNAVAILABLE']
    };
    
    // Initialize the service
    this.initialize();
  }

  /**
   * Initialize the authentication service
   */
  initialize() {
    // Set up automatic token refresh if we have a valid token
    const token = getStoredToken();
    if (token && isValidToken(token)) {
      this.scheduleTokenRefresh(token);
    }

    // Set up axios interceptors for error handling
    this.setupAxiosInterceptors();
  }

  /**
   * Set up axios interceptors for automatic error handling and retries
   */
  setupAxiosInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add timestamp for timeout tracking
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => {
        return Promise.reject(this.normalizeError(error));
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const normalizedError = this.normalizeError(error);
        
        // Check if we should retry
        if (this.shouldRetry(normalizedError, error.config)) {
          return this.retryRequest(error.config);
        }
        
        return Promise.reject(normalizedError);
      }
    );
  }

  /**
   * Normalize error to consistent format
   */
  normalizeError(error) {
    const normalizedError = new Error();
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      normalizedError.code = 'TIMEOUT';
      normalizedError.message = 'Request timed out. Please check your connection and try again.';
      normalizedError.retryable = true;
    } else if (error.code === 'NETWORK_ERROR' || !error.response) {
      normalizedError.code = 'NETWORK_ERROR';
      normalizedError.message = 'Unable to connect to the authentication service. Please check your internet connection.';
      normalizedError.retryable = true;
    } else if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          normalizedError.code = data.details?.error_type || 'BAD_REQUEST';
          normalizedError.message = this.getErrorMessage(data.details?.error_type, data.error);
          normalizedError.retryable = false;
          break;
          
        case 401:
          normalizedError.code = data.details?.error_type || 'UNAUTHORIZED';
          normalizedError.message = this.getErrorMessage(data.details?.error_type, data.error);
          normalizedError.retryable = false;
          break;
          
        case 403:
          normalizedError.code = data.details?.error_type || 'FORBIDDEN';
          normalizedError.message = this.getErrorMessage(data.details?.error_type, data.error);
          normalizedError.retryable = false;
          break;
          
        case 429:
          normalizedError.code = 'RATE_LIMITED';
          normalizedError.message = 'Too many requests. Please wait a moment and try again.';
          normalizedError.retryable = true;
          normalizedError.retryAfter = data.retry_after || 30;
          break;
          
        case 503:
          normalizedError.code = 'SERVICE_UNAVAILABLE';
          normalizedError.message = 'Authentication service is temporarily unavailable. Please try again in a few moments.';
          normalizedError.retryable = true;
          break;
          
        default:
          normalizedError.code = 'SERVER_ERROR';
          normalizedError.message = 'An unexpected server error occurred. Please try again.';
          normalizedError.retryable = status >= 500;
      }
      
      normalizedError.status = status;
      normalizedError.serverData = data;
    } else {
      normalizedError.code = 'UNKNOWN_ERROR';
      normalizedError.message = 'An unexpected error occurred. Please try again.';
      normalizedError.retryable = false;
    }
    
    normalizedError.originalError = error;
    return normalizedError;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(errorType, fallbackMessage) {
    const errorMessages = {
      'domain_restricted': 'Access is restricted to @wareongo.com accounts only.',
      'invalid_auth_code': 'The authorization code is invalid or expired. Please try signing in again.',
      'oauth_error': 'Google authentication failed. Please try again.',
      'missing_code': 'Authorization code is missing. Please try the sign-in process again.',
      'token_expired': 'Your session has expired. Please sign in again.',
      'invalid_token': 'Invalid authentication token. Please sign in again.',
      'missing_token': 'Authentication token is required.',
      'service_unavailable': 'Authentication service is temporarily unavailable. Please try again in a few moments.',
      'configuration_error': 'Authentication service configuration error. Please contact support.'
    };
    
    return errorMessages[errorType] || fallbackMessage || 'An authentication error occurred.';
  }

  /**
   * Check if request should be retried
   */
  shouldRetry(error, config) {
    // Don't retry if already retried max times
    if (config.__retryCount >= this.retryConfig.maxRetries) {
      return false;
    }
    
    // Don't retry if error is not retryable
    if (!error.retryable) {
      return false;
    }
    
    // Don't retry certain error codes
    if (['domain_restricted', 'invalid_auth_code', 'token_expired'].includes(error.code)) {
      return false;
    }
    
    return true;
  }

  /**
   * Retry failed request with exponential backoff
   */
  async retryRequest(config) {
    config.__retryCount = config.__retryCount || 0;
    config.__retryCount++;
    
    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.retryMultiplier, config.__retryCount - 1);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.api(config);
  }

  /**
   * Initiate Google OAuth authentication flow
   * @returns {Promise<void>} Redirects to Google OAuth
   */
  async initiateGoogleAuth() {
    try {
      // Validate configuration
      if (!authConfig.google.clientId) {
        const error = new Error('Google OAuth client ID not configured');
        error.code = 'CONFIGURATION_ERROR';
        error.retryable = false;
        throw error;
      }

      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: authConfig.google.clientId,
        redirect_uri: authConfig.google.redirectUri,
        response_type: authConfig.google.responseType,
        scope: authConfig.google.scope,
        access_type: authConfig.google.accessType,
        prompt: authConfig.google.prompt,
        state: this.generateState()
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      // Store state for validation
      sessionStorage.setItem('oauth_state', params.get('state'));
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating Google OAuth:', error);
      
      const normalizedError = new Error();
      normalizedError.code = error.code || 'OAUTH_INIT_ERROR';
      normalizedError.message = error.message || 'Failed to initiate authentication. Please try again.';
      normalizedError.retryable = error.retryable !== false;
      
      throw normalizedError;
    }
  }

  /**
   * Handle OAuth callback with authorization code
   * @param {string} code - Authorization code from Google
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<object>} User data and authentication status
   */
  async handleAuthCallback(code, state) {
    try {
      // Validate state parameter
      const storedState = sessionStorage.getItem('oauth_state');
      if (!state || state !== storedState) {
        const error = new Error('Security validation failed. Please try signing in again.');
        error.code = 'CSRF_ERROR';
        error.retryable = false;
        throw error;
      }

      // Clear stored state
      sessionStorage.removeItem('oauth_state');

      if (!code) {
        const error = new Error('Authorization code not provided');
        error.code = 'MISSING_AUTH_CODE';
        error.retryable = false;
        throw error;
      }

      // Exchange code for tokens with retry logic
      const response = await this.api.post(authConfig.api.authEndpoints.callback, {
        code,
        redirectUri: authConfig.google.redirectUri
      });

      const { token, user } = response.data;

      if (!token || !user) {
        const error = new Error('Invalid response from authentication server');
        error.code = 'INVALID_SERVER_RESPONSE';
        error.retryable = false;
        throw error;
      }

      // Validate token structure
      if (!isValidToken(token)) {
        const error = new Error('Received invalid token from server');
        error.code = 'INVALID_TOKEN_FORMAT';
        error.retryable = false;
        throw error;
      }

      // Store authentication data
      const success = this.storeAuthData(token, user);
      if (!success) {
        const error = new Error('Failed to store authentication data');
        error.code = 'STORAGE_ERROR';
        error.retryable = false;
        throw error;
      }

      // Set up automatic token refresh
      this.scheduleTokenRefresh(token);

      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      console.error('Error handling auth callback:', error);
      
      // Clean up any partial auth data
      removeStoredAuth();
      
      // Return normalized error
      throw this.normalizeError(error);
    }
  }

  /**
   * Refresh JWT token before expiration
   * @returns {Promise<string>} New JWT token
   */
  async refreshToken() {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    try {
      const currentToken = getStoredToken();
      
      if (!currentToken) {
        throw new Error('No token available for refresh');
      }

      // If token is already expired, redirect to sign-in
      if (isTokenExpired(currentToken)) {
        await this.logout();
        throw new Error('Token expired - please sign in again');
      }

      this.refreshPromise = this.performTokenRefresh(currentToken);
      const newToken = await this.refreshPromise;
      
      return newToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // If refresh fails, logout user
      await this.logout();
      throw error;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh API call
   * @param {string} currentToken - Current JWT token
   * @returns {Promise<string>} New JWT token
   */
  async performTokenRefresh(currentToken) {
    try {
      const response = await this.api.post(
        authConfig.api.authEndpoints.refresh,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`
          }
        }
      );

      const { token, user } = response.data;

      if (!token) {
        throw new Error('No token received from refresh endpoint');
      }

      // Validate new token
      if (!isValidToken(token)) {
        throw new Error('Received invalid token from refresh');
      }

      // Store new authentication data
      const success = this.storeAuthData(token, user);
      if (!success) {
        throw new Error('Failed to store refreshed authentication data');
      }

      // Schedule next refresh
      this.scheduleTokenRefresh(token);

      return token;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Refresh token expired - please sign in again');
      }
      throw error;
    }
  }

  /**
   * Logout user and clean up authentication data
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      const token = getStoredToken();
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      // Clear refresh promise
      this.refreshPromise = null;

      // Call logout endpoint if we have a token
      if (token) {
        try {
          await this.api.post(
            authConfig.api.authEndpoints.logout,
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`
              }
            }
          );
        } catch (error) {
          // Log error but don't fail logout process
          console.warn('Error calling logout endpoint:', error);
        }
      }

      // Remove stored authentication data
      removeStoredAuth();

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Error during logout:', error);
      
      // Always clean up local data even if server call fails
      removeStoredAuth();
      
      return {
        success: true,
        message: 'Logged out (with errors)'
      };
    }
  }

  /**
   * Check if user is currently authenticated
   * @returns {boolean} True if user is authenticated
   */
  isAuthenticated() {
    try {
      const token = getStoredToken();
      const user = getStoredUser();
      
      if (!token || !user) {
        return false;
      }

      // Validate stored data integrity
      if (!validateStoredAuth()) {
        removeStoredAuth();
        return false;
      }

      // Check if token is valid and not expired
      return isValidToken(token);
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    }
  }

  /**
   * Get current user information
   * @returns {object|null} User data or null if not authenticated
   */
  getCurrentUser() {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      const user = getStoredUser();
      const token = getStoredToken();

      // Get fresh user data from token if available
      const tokenUser = getUserFromToken(token);
      
      // Return stored user data, updated with token data if available
      return {
        ...user,
        ...tokenUser
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Get current authentication token
   * @returns {string|null} JWT token or null if not authenticated
   */
  getToken() {
    try {
      if (!this.isAuthenticated()) {
        return null;
      }

      return getStoredToken();
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  /**
   * Get user profile from server
   * @returns {Promise<object>} User profile data
   */
  async getUserProfile() {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await this.api.get(
        authConfig.api.authEndpoints.me,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      
      if (error.response?.status === 401) {
        // Token is invalid, logout user
        await this.logout();
        throw new Error('Authentication expired - please sign in again');
      }
      
      throw new Error('Failed to get user profile');
    }
  }

  /**
   * Store authentication data securely
   * @param {string} token - JWT token
   * @param {object} user - User data
   * @returns {boolean} True if storage was successful
   */
  storeAuthData(token, user) {
    try {
      const tokenStored = setStoredToken(token);
      const userStored = setStoredUser(user);
      
      return tokenStored && userStored;
    } catch (error) {
      console.error('Error storing auth data:', error);
      return false;
    }
  }

  /**
   * Schedule automatic token refresh
   * @param {string} token - Current JWT token
   */
  scheduleTokenRefresh(token) {
    try {
      // Clear existing timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }

      // Don't schedule if token is already expired
      if (isTokenExpired(token)) {
        return;
      }

      // Calculate when to refresh (before expiration threshold)
      const timeUntilRefresh = this.calculateRefreshTime(token);
      
      if (timeUntilRefresh > 0) {
        this.refreshTimer = setTimeout(async () => {
          try {
            await this.refreshToken();
          } catch (error) {
            console.error('Automatic token refresh failed:', error);
          }
        }, timeUntilRefresh);
      }
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
  }

  /**
   * Calculate when to refresh token (in milliseconds)
   * @param {string} token - JWT token
   * @returns {number} Milliseconds until refresh should occur
   */
  calculateRefreshTime(token) {
    try {
      if (isTokenExpiringSoon(token)) {
        // If already expiring soon, refresh immediately
        return 0;
      }

      // Get token expiration time
      const decoded = getUserFromToken(token);
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // Refresh 5 minutes before expiration (or at threshold from config)
      const refreshTime = timeUntilExpiration - authConfig.jwt.refreshThreshold;
      
      // Ensure we don't schedule negative time
      return Math.max(0, refreshTime);
    } catch (error) {
      console.error('Error calculating refresh time:', error);
      return 0;
    }
  }

  /**
   * Generate random state parameter for OAuth CSRF protection
   * @returns {string} Random state string
   */
  generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate authentication configuration
   * @returns {boolean} True if configuration is valid
   */
  validateConfig() {
    try {
      const requiredFields = [
        'google.clientId',
        'google.redirectUri',
        'api.baseUrl'
      ];

      for (const field of requiredFields) {
        const value = field.split('.').reduce((obj, key) => obj?.[key], authConfig);
        if (!value) {
          console.error(`Missing required auth config: ${field}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating auth config:', error);
      return false;
    }
  }
}

// Create and export singleton instance
export const authService = new AuthService();

// Export class for testing
export { AuthService };