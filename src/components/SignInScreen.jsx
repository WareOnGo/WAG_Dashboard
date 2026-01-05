import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Alert, Spin, notification } from 'antd';
import { GoogleOutlined, LoadingOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { authConfig, validateAuthConfig } from '../config/auth.js';
import { useViewport } from '../hooks';
import AuthErrorBoundary from './AuthErrorBoundary.jsx';
import './SignInScreen.css';

const { Title, Text } = Typography;

/**
 * Sign-in screen component with Google OAuth integration
 * Provides responsive design and comprehensive error handling for authentication
 */
const SignInScreen = () => {
  const { isMobile } = useViewport();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configValid, setConfigValid] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Maximum retry attempts
  const MAX_RETRIES = 3;

  // Validate configuration on mount
  useEffect(() => {
    const validateConfig = () => {
      try {
        const isValid = validateAuthConfig();
        setConfigValid(isValid);
        
        if (!isValid) {
          setError({
            type: 'configuration',
            message: 'Authentication configuration is incomplete. Please check environment variables.',
            retryable: false
          });
        }
      } catch (err) {
        console.error('Error validating auth config:', err);
        setError({
          type: 'configuration',
          message: 'Failed to validate authentication configuration.',
          retryable: true
        });
      }
    };

    validateConfig();
  }, []);

  // Handle OAuth callback errors from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const oauthError = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (oauthError) {
      const errorMessage = getOAuthErrorMessage(oauthError, errorDescription);
      setError({
        type: 'oauth',
        message: errorMessage,
        retryable: !['access_denied'].includes(oauthError)
      });

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  /**
   * Get user-friendly OAuth error message
   */
  const getOAuthErrorMessage = useCallback((error, description) => {
    const errorMessages = {
      'access_denied': 'You cancelled the sign-in process. Please try again to access the application.',
      'invalid_request': 'Invalid authentication request. Please try signing in again.',
      'unauthorized_client': 'Authentication service configuration error. Please contact support.',
      'unsupported_response_type': 'Authentication service configuration error. Please contact support.',
      'invalid_scope': 'Authentication service configuration error. Please contact support.',
      'server_error': 'Google authentication service is temporarily unavailable. Please try again.',
      'temporarily_unavailable': 'Google authentication service is temporarily unavailable. Please try again.'
    };

    return errorMessages[error] || description || 'Authentication failed. Please try again.';
  }, []);

  /**
   * Initiates Google OAuth flow with error handling and retry logic
   */
  const handleGoogleSignIn = useCallback(async () => {
    if (!configValid) {
      setError({
        type: 'configuration',
        message: 'Authentication is not properly configured',
        retryable: false
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Add artificial delay for better UX on fast connections
      await new Promise(resolve => setTimeout(resolve, 500));

      // Build Google OAuth URL with error handling
      const params = new URLSearchParams({
        client_id: authConfig.google.clientId,
        redirect_uri: authConfig.google.redirectUri,
        response_type: authConfig.google.responseType,
        scope: authConfig.google.scope,
        access_type: authConfig.google.accessType,
        prompt: authConfig.google.prompt,
        state: generateSecureState()
      });

      // Validate required parameters
      if (!params.get('client_id')) {
        throw new Error('Google Client ID is not configured');
      }

      if (!params.get('redirect_uri')) {
        throw new Error('OAuth redirect URI is not configured');
      }

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      // Store state for CSRF protection
      sessionStorage.setItem('oauth_state', params.get('state'));
      sessionStorage.setItem('oauth_timestamp', Date.now().toString());
      
      // Show loading notification
      notification.info({
        message: 'Redirecting to Google',
        description: 'You will be redirected to Google for authentication...',
        duration: 2
      });

      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (err) {
      console.error('Error initiating Google OAuth:', err);
      
      setError({
        type: 'oauth_init',
        message: err.message || 'Failed to start authentication process. Please try again.',
        retryable: true
      });
      
      setIsLoading(false);
    }
  }, [configValid]);

  /**
   * Generate cryptographically secure state parameter
   */
  const generateSecureState = useCallback(() => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }, []);

  /**
   * Handle retry with exponential backoff
   */
  const handleRetry = useCallback(async () => {
    if (retryCount >= MAX_RETRIES) {
      setError(prev => ({
        ...prev,
        message: 'Maximum retry attempts reached. Please refresh the page or contact support.',
        retryable: false
      }));
      return;
    }

    setIsRetrying(true);
    setRetryCount(prev => prev + 1);

    // Exponential backoff delay
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Clear error and retry
      setError(null);
      
      if (error?.type === 'configuration') {
        // Re-validate configuration
        const isValid = validateAuthConfig();
        setConfigValid(isValid);
        
        if (!isValid) {
          throw new Error('Configuration is still invalid');
        }
      } else {
        // Retry the sign-in process
        await handleGoogleSignIn();
      }
    } catch (err) {
      setError({
        type: error?.type || 'retry',
        message: err.message || 'Retry failed. Please try again.',
        retryable: retryCount < MAX_RETRIES - 1
      });
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount, error, handleGoogleSignIn, configValid]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  /**
   * Handle page refresh
   */
  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  /**
   * Get error alert type based on error type
   */
  const getErrorType = useCallback((errorType) => {
    switch (errorType) {
      case 'configuration':
        return 'warning';
      case 'oauth':
      case 'oauth_init':
        return 'error';
      default:
        return 'error';
    }
  }, []);

  return (
    <AuthErrorBoundary onRetry={clearError}>
      <div className="signin-screen">
        <div className="signin-container">
          {/* Header Section */}
          <div className="signin-header">
            <div className="signin-logo">
              <span className="logo-icon">🏢</span>
            </div>
            <Title 
              level={isMobile ? 3 : 2} 
              className="signin-title"
            >
              Warehouse Portal
            </Title>
            <Text className="signin-subtitle">
              Sign in with your @wareongo.com account to access the warehouse management system
            </Text>
          </div>

          {/* Error Display */}
          {error && (
            <Alert
              message={error.type === 'configuration' ? 'Configuration Error' : 'Authentication Error'}
              description={
                <div>
                  <p>{error.message}</p>
                  {retryCount > 0 && (
                    <Text type="secondary">
                      Retry attempt: {retryCount}/{MAX_RETRIES}
                    </Text>
                  )}
                </div>
              }
              type={getErrorType(error.type)}
              showIcon
              closable
              onClose={clearError}
              className="signin-error"
              action={
                error.retryable && (
                  <Button
                    size="small"
                    type="link"
                    icon={<ReloadOutlined />}
                    onClick={handleRetry}
                    loading={isRetrying}
                    disabled={retryCount >= MAX_RETRIES}
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </Button>
                )
              }
            />
          )}

          {/* Sign-in Form */}
          <div className="signin-form">
            <Button
              type="primary"
              size={isMobile ? 'large' : 'middle'}
              icon={isLoading ? <LoadingOutlined /> : <GoogleOutlined />}
              onClick={handleGoogleSignIn}
              loading={isLoading}
              disabled={!configValid || isLoading || isRetrying}
              className="google-signin-btn"
              block
            >
              {isLoading ? 'Connecting...' : 'Sign in with Google'}
            </Button>

            <div className="signin-info">
              <Text type="secondary" className="signin-note">
                Only @wareongo.com email addresses are allowed
              </Text>
              
              {!configValid && (
                <div className="config-warning">
                  <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 4 }} />
                  <Text type="warning">
                    Authentication not configured
                  </Text>
                </div>
              )}
            </div>

            {/* Additional Actions */}
            {error && !error.retryable && (
              <div className="signin-actions">
                <Button
                  type="default"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  block
                >
                  Refresh Page
                </Button>
              </div>
            )}
          </div>

          {/* Loading State */}
          {(isLoading || isRetrying) && (
            <div className="signin-loading">
              <Spin 
                indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}
                tip={isLoading ? "Redirecting to Google..." : "Retrying..."}
              />
            </div>
          )}
        </div>
      </div>
    </AuthErrorBoundary>
  );
};

export default SignInScreen;