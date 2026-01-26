import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { notification } from 'antd';
import { authConfig } from '../config/auth.js';
import { getStoredToken, getStoredUser, setStoredToken, setStoredUser, removeStoredAuth } from '../utils/tokenStorage.js';
import { isTokenExpired } from '../utils/jwtUtils.js';

/**
 * Authentication Context
 */
const AuthContext = createContext(null);

/**
 * Authentication action types
 */
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  SET_UNAUTHENTICATED: 'SET_UNAUTHENTICATED',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_USER: 'SET_USER',
  LOGOUT: 'LOGOUT',
  SET_RETRY_COUNT: 'SET_RETRY_COUNT'
};

/**
 * Initial authentication state
 */
const initialState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  token: null,
  error: null,
  retryCount: 0
};

/**
 * Authentication reducer
 */
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error // Clear error when starting to load
      };

    case AUTH_ACTIONS.SET_AUTHENTICATED:
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        token: action.payload.token,
        error: null,
        retryCount: 0
      };

    case AUTH_ACTIONS.SET_UNAUTHENTICATED:
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        token: null,
        error: null
      };

    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload
      };

    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null,
        retryCount: 0
      };

    case AUTH_ACTIONS.SET_USER:
      return {
        ...state,
        user: action.payload
      };

    case AUTH_ACTIONS.LOGOUT:
      return {
        ...initialState,
        isLoading: false
      };

    case AUTH_ACTIONS.SET_RETRY_COUNT:
      return {
        ...state,
        retryCount: action.payload
      };

    default:
      return state;
  }
};

/**
 * Authentication Provider Component
 */
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  /**
   * Normalize error to consistent format
   */
  const normalizeError = useCallback((error) => {
    if (typeof error === 'string') {
      return {
        message: error,
        code: 'GENERIC_ERROR',
        retryable: true
      };
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        retryable: error.retryable !== false
      };
    }

    return {
      message: error.message || 'An unexpected error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      retryable: error.retryable !== false
    };
  }, []);

  /**
   * Handle authentication errors with user notifications
   */
  const handleAuthError = useCallback((error, context = 'Authentication') => {
    const normalizedError = normalizeError(error);

    console.error(`${context} error:`, normalizedError);

    // Set error in state
    dispatch({
      type: AUTH_ACTIONS.SET_ERROR,
      payload: normalizedError
    });

    // Show user notification for certain error types
    if (normalizedError.code === 'TOKEN_EXPIRED') {
      notification.warning({
        message: 'Session Expired',
        description: 'Your session has expired. Please sign in again.',
        duration: 5
      });
    } else if (normalizedError.code === 'NETWORK_ERROR') {
      notification.error({
        message: 'Connection Error',
        description: 'Unable to connect to the authentication service. Please check your internet connection.',
        duration: 8
      });
    } else if (normalizedError.code === 'SERVICE_UNAVAILABLE') {
      notification.error({
        message: 'Service Unavailable',
        description: 'Authentication service is temporarily unavailable. Please try again in a few moments.',
        duration: 8
      });
    }
  }, [normalizeError]);

  /**
   * Initialize authentication state from stored tokens
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

        const storedToken = getStoredToken();
        const storedUser = getStoredUser();

        if (!storedToken || !storedUser) {
          dispatch({ type: AUTH_ACTIONS.SET_UNAUTHENTICATED });
          return;
        }

        // Check if token is expired
        if (isTokenExpired(storedToken)) {
          // Token is expired, clear auth and let user log in again
          removeStoredAuth();
          dispatch({ type: AUTH_ACTIONS.SET_UNAUTHENTICATED });
          return;
        } else {
          // Token is valid, set authenticated state
          dispatch({
            type: AUTH_ACTIONS.SET_AUTHENTICATED,
            payload: {
              user: storedUser,
              token: storedToken
            }
          });
        }
      } catch (error) {
        console.error('Error initializing authentication:', error);
        removeStoredAuth();
        handleAuthError(error, 'Authentication initialization');
      }
    };

    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Set authenticated user and token
   */
  const setAuthenticated = useCallback((user, token) => {
    try {
      // Validate inputs
      if (!user || !token) {
        throw new Error('User and token are required');
      }

      // Store in localStorage
      const tokenStored = setStoredToken(token);
      const userStored = setStoredUser(user);

      if (!tokenStored || !userStored) {
        throw new Error('Failed to store authentication data');
      }

      // Update state
      dispatch({
        type: AUTH_ACTIONS.SET_AUTHENTICATED,
        payload: { user, token }
      });

      // Show success notification
      notification.success({
        message: 'Signed In Successfully',
        description: `Welcome back, ${user.name || user.email}!`,
        duration: 3
      });
    } catch (error) {
      console.error('Error setting authentication:', error);
      handleAuthError(error, 'Setting authentication');
    }
  }, [handleAuthError]);

  /**
   * Logout user with error handling
   */
  const logout = useCallback(async () => {
    try {
      // Call logout endpoint if we have a token
      const currentToken = getStoredToken();
      if (currentToken) {
        try {
          const response = await fetch(`${authConfig.api.baseUrl}${authConfig.api.authEndpoints.logout}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentToken}`
            }
          });

          if (!response.ok) {
            console.warn('Logout endpoint returned error:', response.status);
          }
        } catch (error) {
          // Log error but don't fail logout process
          console.warn('Error calling logout endpoint:', error);
        }
      }

      // Remove from localStorage
      removeStoredAuth();

      // Update state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });

      // Show logout notification
      notification.info({
        message: 'Signed Out',
        description: 'You have been signed out successfully.',
        duration: 3
      });
    } catch (error) {
      console.error('Error during logout:', error);

      // Always clean up local data even if server call fails
      removeStoredAuth();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });

      handleAuthError(error, 'Logout');
    }
  }, [handleAuthError]);

  /**
   * Refresh authentication token with retry logic
   */
  const refreshToken = useCallback(async (retryAttempt = 0) => {
    const maxRetries = 3;

    try {
      const currentToken = getStoredToken();
      if (!currentToken) {
        return false;
      }

      const response = await fetch(`${authConfig.api.baseUrl}${authConfig.api.authEndpoints.refresh}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, can't refresh
          return false;
        }

        if (response.status >= 500 && retryAttempt < maxRetries) {
          // Server error, retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          return refreshToken(retryAttempt + 1);
        }

        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.token && data.user) {
        setAuthenticated(data.user, data.token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);

      if (retryAttempt < maxRetries && error.code !== 'TOKEN_EXPIRED') {
        // Retry for network errors
        const delay = Math.min(1000 * Math.pow(2, retryAttempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return refreshToken(retryAttempt + 1);
      }

      return false;
    }
  }, [setAuthenticated]);

  /**
   * Update user information
   */
  const updateUser = useCallback((userData) => {
    try {
      if (!userData) {
        throw new Error('User data is required');
      }

      setStoredUser(userData);
      dispatch({
        type: AUTH_ACTIONS.SET_USER,
        payload: userData
      });
    } catch (error) {
      console.error('Error updating user:', error);
      handleAuthError(error, 'Updating user');
    }
  }, [handleAuthError]);

  /**
   * Clear authentication error
   */
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  /**
   * Retry failed authentication operation
   */
  const retryAuth = useCallback(async () => {
    const maxRetries = 3;

    if (state.retryCount >= maxRetries) {
      handleAuthError({
        message: 'Maximum retry attempts reached. Please refresh the page.',
        code: 'MAX_RETRIES_EXCEEDED',
        retryable: false
      });
      return false;
    }

    dispatch({
      type: AUTH_ACTIONS.SET_RETRY_COUNT,
      payload: state.retryCount + 1
    });

    try {
      // Try to refresh token
      const refreshed = await refreshToken();
      if (refreshed) {
        return true;
      }

      // If refresh fails, logout user
      await logout();
      return false;
    } catch (error) {
      handleAuthError(error, 'Retry authentication');
      return false;
    }
  }, [state.retryCount, refreshToken, logout, handleAuthError]);

  /**
   * Handle OAuth callback
   */
  const handleAuthCallback = useCallback(async (code, state) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      // Validate state parameter
      const storedState = sessionStorage.getItem('oauth_state');
      if (!state || state !== storedState) {
        throw new Error('Security validation failed. Please try signing in again.');
      }

      // Clear stored state
      sessionStorage.removeItem('oauth_state');

      if (!code) {
        throw new Error('Authorization code not provided');
      }

      // Exchange code for tokens
      const response = await fetch(`${authConfig.api.baseUrl}${authConfig.api.authEndpoints.callback}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          redirectUri: authConfig.google.redirectUri
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const data = await response.json();

      if (!data.token || !data.user) {
        throw new Error('Invalid response from authentication server');
      }

      // Set authenticated state
      setAuthenticated(data.user, data.token);

      return {
        success: true,
        user: data.user,
        token: data.token
      };
    } catch (error) {
      console.error('Error handling auth callback:', error);
      handleAuthError(error, 'OAuth callback');
      throw error;
    }
  }, [setAuthenticated, handleAuthError]);

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = useCallback(() => {
    return state.isAuthenticated && state.token && !isTokenExpired(state.token);
  }, [state.isAuthenticated, state.token]);

  /**
   * Get current authentication token
   */
  const getToken = useCallback(() => {
    return state.token;
  }, [state.token]);

  const contextValue = {
    // State
    ...state,

    // Actions
    setAuthenticated,
    logout,
    refreshToken,
    updateUser,
    clearError,
    retryAuth,
    handleAuthCallback,

    // Utilities
    isAuthenticated: isAuthenticated(),
    getToken
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use authentication context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;