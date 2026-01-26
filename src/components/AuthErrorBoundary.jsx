import React from 'react';
import { Result, Button, Typography } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import './AuthErrorBoundary.css';

const { Paragraph, Text } = Typography;

/**
 * Error boundary specifically for authentication components
 * Catches and handles errors in authentication flow
 */
class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for monitoring
    console.error('Authentication Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      hasError: true
    });

    // Report error to monitoring service if available
    if (window.reportError) {
      window.reportError(error, {
        component: 'AuthErrorBoundary',
        errorInfo,
        retryCount: this.state.retryCount
      });
    }
  }

  /**
   * Handle retry action
   */
  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }));

    // Call onRetry prop if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  /**
   * Handle refresh page action
   */
  handleRefresh = () => {
    window.location.reload();
  };

  /**
   * Get error message based on error type
   */
  getErrorMessage() {
    const { error } = this.state;
    
    if (!error) {
      return 'An unexpected error occurred in the authentication system.';
    }

    // Handle specific authentication errors
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'Unable to connect to the authentication service. Please check your internet connection and try again.';
    }

    if (error.message.includes('timeout')) {
      return 'The authentication request timed out. Please try again.';
    }

    if (error.message.includes('CORS')) {
      return 'Authentication service configuration error. Please contact support.';
    }

    if (error.message.includes('OAuth') || error.message.includes('Google')) {
      return 'Google authentication service is temporarily unavailable. Please try again in a few moments.';
    }

    if (error.message.includes('token') || error.message.includes('Token')) {
      return 'Authentication token error. Please sign in again.';
    }

    if (error.message.includes('domain') || error.message.includes('Domain')) {
      return 'Access is restricted to @wareongo.com accounts only.';
    }

    // Generic error message
    return 'An error occurred during authentication. Please try again.';
  }

  /**
   * Get error title based on error type
   */
  getErrorTitle() {
    const { error } = this.state;
    
    if (!error) {
      return 'Authentication Error';
    }

    if (error.message.includes('Network') || error.message.includes('timeout')) {
      return 'Connection Error';
    }

    if (error.message.includes('domain') || error.message.includes('Domain')) {
      return 'Access Restricted';
    }

    if (error.message.includes('OAuth') || error.message.includes('Google')) {
      return 'Service Unavailable';
    }

    return 'Authentication Error';
  }

  /**
   * Determine if retry should be available
   */
  shouldShowRetry() {
    const { error } = this.state;
    const { retryCount } = this.state;
    
    // Don't show retry for domain restriction errors
    if (error && (error.message.includes('domain') || error.message.includes('Domain'))) {
      return false;
    }

    // Limit retry attempts
    return retryCount < 3;
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.getErrorMessage();
      const errorTitle = this.getErrorTitle();
      const showRetry = this.shouldShowRetry();

      return (
        <div className="auth-error-boundary">
          <Result
            status="error"
            icon={<ExclamationCircleOutlined />}
            title={errorTitle}
            subTitle={errorMessage}
            extra={[
              showRetry && (
                <Button 
                  key="retry"
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                >
                  Try Again
                </Button>
              ),
              <Button 
                key="refresh"
                onClick={this.handleRefresh}
              >
                Refresh Page
              </Button>
            ].filter(Boolean)}
          >
            <div className="error-details">
              <Paragraph>
                <Text strong>What you can do:</Text>
              </Paragraph>
              <ul>
                <li>Check your internet connection</li>
                <li>Ensure you're using a @wareongo.com email address</li>
                <li>Try refreshing the page</li>
                <li>Contact support if the problem persists</li>
              </ul>
              
              {import.meta.env.DEV && this.state.error && (
                <details style={{ marginTop: 16 }}>
                  <summary>Error Details (Development)</summary>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: 8, 
                    fontSize: 12,
                    overflow: 'auto',
                    maxHeight: 200
                  }}>
                    {this.state.error.toString()}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AuthErrorBoundary;