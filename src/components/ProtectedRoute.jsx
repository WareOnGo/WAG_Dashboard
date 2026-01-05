import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin, Alert } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useViewport } from '../hooks';
import './ProtectedRoute.css';

/**
 * Protected Route Component
 * Guards authenticated pages and redirects unauthenticated users to sign-in
 */
const ProtectedRoute = ({ children }) => {
  const { 
    isAuthenticated, 
    isLoading, 
    error, 
    clearError,
    refreshToken 
  } = useAuth();
  const { isMobile } = useViewport();
  const navigate = useNavigate();

  // Attempt token refresh if authentication fails
  useEffect(() => {
    const handleAuthFailure = async () => {
      if (!isAuthenticated && !isLoading && !error) {
        try {
          const refreshed = await refreshToken();
          if (!refreshed) {
            // Token refresh failed, redirect to sign-in
            console.log('Token refresh failed, redirecting to sign-in');
            navigate('/', { replace: true });
          }
        } catch (err) {
          console.error('Error during token refresh:', err);
          navigate('/', { replace: true });
        }
      }
    };

    handleAuthFailure();
  }, [isAuthenticated, isLoading, error, refreshToken, navigate]);

  // Show loading state during authentication check
  if (isLoading) {
    return (
      <div className="protected-route-loading">
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-logo">
              <span className="logo-icon">🏢</span>
            </div>
            <Spin 
              indicator={<LoadingOutlined style={{ fontSize: isMobile ? 20 : 24 }} spin />}
              tip="Checking authentication..."
              size={isMobile ? 'default' : 'large'}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show error state if authentication error occurred
  if (error) {
    return (
      <div className="protected-route-error">
        <div className="error-container">
          <Alert
            message="Authentication Error"
            description={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            action={
              <button 
                className="retry-btn"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isAuthenticated) {
    // Redirect to home/sign-in page
    navigate('/', { replace: true });
    return null;
  }

  // Render protected content if authenticated
  return (
    <div className="protected-route-content">
      {children}
    </div>
  );
};

export default ProtectedRoute;