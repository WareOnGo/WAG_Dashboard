import { authConfig } from '../config/auth.js';

/**
 * Token storage utilities with security considerations
 */

/**
 * Check if localStorage is available
 */
const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Safely get item from localStorage
 */
const safeGetItem = (key) => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return null;
  }
};

/**
 * Safely set item in localStorage
 */
const safeSetItem = (key, value) => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error('Error writing to localStorage:', error);
    return false;
  }
};

/**
 * Safely remove item from localStorage
 */
const safeRemoveItem = (key) => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available');
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error removing from localStorage:', error);
    return false;
  }
};

/**
 * Get stored authentication token
 */
export const getStoredToken = () => {
  const token = safeGetItem(authConfig.jwt.tokenKey);
  
  if (!token) {
    return null;
  }

  try {
    // Token is stored as plain string
    return token;
  } catch (error) {
    console.error('Error parsing stored token:', error);
    // Remove corrupted token
    safeRemoveItem(authConfig.jwt.tokenKey);
    return null;
  }
};

/**
 * Store authentication token
 */
export const setStoredToken = (token) => {
  if (!token) {
    console.error('Cannot store empty token');
    return false;
  }

  try {
    return safeSetItem(authConfig.jwt.tokenKey, token);
  } catch (error) {
    console.error('Error storing token:', error);
    return false;
  }
};

/**
 * Get stored user data
 */
export const getStoredUser = () => {
  const userData = safeGetItem(authConfig.jwt.userKey);
  
  if (!userData) {
    return null;
  }

  try {
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error parsing stored user data:', error);
    // Remove corrupted user data
    safeRemoveItem(authConfig.jwt.userKey);
    return null;
  }
};

/**
 * Store user data
 */
export const setStoredUser = (userData) => {
  if (!userData) {
    console.error('Cannot store empty user data');
    return false;
  }

  try {
    const userDataString = JSON.stringify(userData);
    return safeSetItem(authConfig.jwt.userKey, userDataString);
  } catch (error) {
    console.error('Error storing user data:', error);
    return false;
  }
};

/**
 * Remove all stored authentication data
 */
export const removeStoredAuth = () => {
  try {
    safeRemoveItem(authConfig.jwt.tokenKey);
    safeRemoveItem(authConfig.jwt.userKey);
    return true;
  } catch (error) {
    console.error('Error removing stored auth data:', error);
    return false;
  }
};

/**
 * Check if authentication data exists in storage
 */
export const hasStoredAuth = () => {
  const token = getStoredToken();
  const user = getStoredUser();
  return !!(token && user);
};

/**
 * Clear all authentication-related data from localStorage
 * This is useful for complete cleanup during logout or errors
 */
export const clearAllAuthData = () => {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    // Get all keys that might be auth-related
    const authKeys = [
      authConfig.jwt.tokenKey,
      authConfig.jwt.userKey,
      // Add any other auth-related keys here
    ];

    authKeys.forEach(key => {
      safeRemoveItem(key);
    });

    return true;
  } catch (error) {
    console.error('Error clearing auth data:', error);
    return false;
  }
};

/**
 * Validate stored authentication data integrity
 */
export const validateStoredAuth = () => {
  const token = getStoredToken();
  const user = getStoredUser();

  if (!token || !user) {
    return false;
  }

  // Basic validation
  if (typeof token !== 'string' || token.length === 0) {
    console.warn('Invalid token format in storage');
    return false;
  }

  if (typeof user !== 'object' || !user.email || !user.id) {
    console.warn('Invalid user data format in storage');
    return false;
  }

  // Validate domain if specified
  if (authConfig.security.allowedDomain) {
    const emailDomain = user.email.split('@')[1];
    if (emailDomain !== authConfig.security.allowedDomain) {
      console.warn('User domain does not match allowed domain');
      return false;
    }
  }

  return true;
};