import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

/**
 * OAuth Callback Handler Component
 * Processes the OAuth callback and redirects to dashboard
 */
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();
  const [error, setError] = useState(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        const token = searchParams.get('token');
        const userStr = searchParams.get('user');
        const errorParam = searchParams.get('error');

        // Handle errors
        if (errorParam) {
          setError(errorParam);
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        // Validate we have the token and user data
        if (!token || !userStr) {
          setError('Authentication data missing. Please try again.');
          setTimeout(() => navigate('/', { replace: true }), 3000);
          return;
        }

        // Parse user data
        const user = JSON.parse(decodeURIComponent(userStr));

        // Set authenticated state
        setAuthenticated(user, token);

        // Redirect to dashboard on success
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } catch (err) {
        console.error('Callback processing error:', err);
        setError(err.message || 'Authentication failed. Please try again.');
        setTimeout(() => navigate('/', { replace: true }), 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate, setAuthenticated]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#141414',
      color: 'white',
      padding: '20px',
      textAlign: 'center'
    }}>
      {error ? (
        <>
          <div style={{ fontSize: '48px', marginBottom: '24px' }}>⚠️</div>
          <div style={{ fontSize: '18px', marginBottom: '16px', color: '#ff4d4f' }}>
            {error}
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.65)' }}>
            Redirecting to sign in...
          </div>
        </>
      ) : (
        <>
          <Spin size="large" />
          <div style={{ marginTop: '24px', fontSize: '16px' }}>
            Completing authentication...
          </div>
        </>
      )}
    </div>
  );
}

export default AuthCallback;
