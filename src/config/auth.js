/**
 * Authentication configuration for Google OAuth and JWT handling
 */

export const authConfig = {
  // Google OAuth Configuration
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirectUri: import.meta.env.VITE_OAUTH_REDIRECT_URI,
    scope: 'openid email profile',
    responseType: 'code',
    accessType: 'offline',
    prompt: 'consent'
  },

  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    authEndpoints: {
      callback: '/auth/google/callback',
      refresh: '/auth/refresh',
      logout: '/auth/logout',
      me: '/auth/me'
    }
  },

  // JWT Configuration
  jwt: {
    tokenKey: 'warehouse_auth_token',
    userKey: 'warehouse_user_data',
    refreshThreshold: 5 * 60 * 1000, // 5 minutes before expiration
  },

  // Security Configuration
  security: {
    allowedDomain: 'wareongo.com',
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  }
};

/**
 * Validates the authentication configuration
 * @returns {boolean} True if configuration is valid
 */
export const validateAuthConfig = () => {
  const requiredEnvVars = [
    'VITE_API_BASE_URL',
    'VITE_GOOGLE_CLIENT_ID',
    'VITE_OAUTH_REDIRECT_URI'
  ];

  const missingVars = requiredEnvVars.filter(
    varName => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    return false;
  }

  return true;
};