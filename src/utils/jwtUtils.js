import { jwtDecode } from 'jwt-decode';
import { authConfig } from '../config/auth.js';

/**
 * JWT utility functions for token handling
 */

/**
 * Decode JWT token safely
 * @param {string} token - JWT token to decode
 * @returns {object|null} Decoded token payload or null if invalid
 */
export const decodeToken = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    return jwtDecode(token);
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return null;
  }
};

/**
 * Check if JWT token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if token is expired or invalid
 */
export const isTokenExpired = (token) => {
  if (!token) {
    return true;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }

    // Get current time in seconds (JWT exp is in seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    return decoded.exp < currentTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true;
  }
};

/**
 * Check if JWT token will expire soon
 * @param {string} token - JWT token to check
 * @param {number} thresholdMs - Threshold in milliseconds (default from config)
 * @returns {boolean} True if token will expire within threshold
 */
export const isTokenExpiringSoon = (token, thresholdMs = authConfig.jwt.refreshThreshold) => {
  if (!token) {
    return true;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return true;
    }

    // Get current time in seconds
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Calculate threshold time in seconds
    const thresholdTime = currentTime + Math.floor(thresholdMs / 1000);
    
    // Check if token expires within threshold
    return decoded.exp < thresholdTime;
  } catch (error) {
    console.error('Error checking token expiration threshold:', error);
    return true;
  }
};

/**
 * Get token expiration time
 * @param {string} token - JWT token
 * @returns {Date|null} Expiration date or null if invalid
 */
export const getTokenExpiration = (token) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded || !decoded.exp) {
      return null;
    }

    // Convert from seconds to milliseconds
    return new Date(decoded.exp * 1000);
  } catch (error) {
    console.error('Error getting token expiration:', error);
    return null;
  }
};

/**
 * Get time remaining until token expires
 * @param {string} token - JWT token
 * @returns {number} Time remaining in milliseconds, or 0 if expired/invalid
 */
export const getTokenTimeRemaining = (token) => {
  if (!token) {
    return 0;
  }

  try {
    const expirationDate = getTokenExpiration(token);
    
    if (!expirationDate) {
      return 0;
    }

    const timeRemaining = expirationDate.getTime() - Date.now();
    return Math.max(0, timeRemaining);
  } catch (error) {
    console.error('Error calculating token time remaining:', error);
    return 0;
  }
};

/**
 * Extract user information from JWT token
 * @param {string} token - JWT token
 * @returns {object|null} User information or null if invalid
 */
export const getUserFromToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return null;
    }

    // Extract user information from token payload
    return {
      id: decoded.id || decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      domain: decoded.domain,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
};

/**
 * Validate JWT token structure and content
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is structurally valid
 */
export const validateTokenStructure = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return false;
    }

    // Check required fields
    const requiredFields = ['id', 'email', 'exp', 'iat'];
    const hasRequiredFields = requiredFields.every(field => 
      decoded.hasOwnProperty(field) || decoded.hasOwnProperty('sub')
    );

    if (!hasRequiredFields) {
      console.warn('Token missing required fields');
      return false;
    }

    // Validate email format
    if (decoded.email && !isValidEmail(decoded.email)) {
      console.warn('Token contains invalid email format');
      return false;
    }

    // Validate domain if configured
    if (authConfig.security.allowedDomain && decoded.email) {
      const emailDomain = decoded.email.split('@')[1];
      if (emailDomain !== authConfig.security.allowedDomain) {
        console.warn('Token email domain does not match allowed domain');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating token structure:', error);
    return false;
  }
};

/**
 * Simple email validation
 * @param {string} email - Email to validate
 * @returns {boolean} True if email format is valid
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Format token expiration for display
 * @param {string} token - JWT token
 * @returns {string} Formatted expiration time or empty string
 */
export const formatTokenExpiration = (token) => {
  const expiration = getTokenExpiration(token);
  
  if (!expiration) {
    return '';
  }

  return expiration.toLocaleString();
};

/**
 * Check if token is valid (not expired and structurally correct)
 * @param {string} token - JWT token to validate
 * @returns {boolean} True if token is valid
 */
export const isValidToken = (token) => {
  return validateTokenStructure(token) && !isTokenExpired(token);
};