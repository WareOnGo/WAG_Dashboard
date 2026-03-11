import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notification } from 'antd';
import { getStoredToken } from '../utils/tokenStorage.js';
import { isTokenExpired, isTokenExpiringSoon, getTokenTimeRemaining } from '../utils/jwtUtils.js';

/**
 * Hook that watches for token expiry and proactively notifies the user.
 * 
 * - When the token is about to expire (within the warning threshold), shows a warning notification.
 * - When the token has expired, triggers logout and redirects to /session-expired.
 * - Runs on a polling interval so users are never surprised by a stale session.
 *
 * @param {object} options
 * @param {boolean} options.isAuthenticated - Whether the user is currently authenticated
 * @param {Function} options.logout - Logout function from auth context
 * @param {number} [options.checkIntervalMs=30000] - How often to check token status (ms)
 * @param {number} [options.warningThresholdMs=300000] - When to show "expiring soon" warning (ms, default 5 min)
 */
export const useTokenExpiryWatcher = ({
  isAuthenticated,
  logout,
  checkIntervalMs = 30_000,
  warningThresholdMs = 5 * 60 * 1000,
}) => {
  const navigate = useNavigate();
  const warningShownRef = useRef(false);
  const intervalRef = useRef(null);

  const handleExpired = useCallback(async () => {
    // Prevent multiple triggers
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    try {
      await logout();
    } catch {
      // logout is best-effort
    }

    navigate('/session-expired', { replace: true });
  }, [logout, navigate]);

  const checkToken = useCallback(() => {
    const token = getStoredToken();

    // No token while we think we're authenticated → session was cleared elsewhere
    if (!token) {
      handleExpired();
      return;
    }

    // Token already expired
    if (isTokenExpired(token)) {
      handleExpired();
      return;
    }

    // Token expiring soon — show a one-time warning
    if (isTokenExpiringSoon(token, warningThresholdMs) && !warningShownRef.current) {
      warningShownRef.current = true;
      const remaining = getTokenTimeRemaining(token);
      const minutes = Math.max(1, Math.round(remaining / 60_000));

      notification.warning({
        key: 'session-expiry-warning',
        message: 'Session Expiring Soon',
        description: `Your session will expire in about ${minutes} minute${minutes !== 1 ? 's' : ''}. Please save your work.`,
        duration: 0, // persist until dismissed
      });
    }
  }, [handleExpired, warningThresholdMs]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Reset warning flag when not authenticated
      warningShownRef.current = false;
      return;
    }

    // Run immediately on mount / auth change
    checkToken();

    // Then poll
    intervalRef.current = setInterval(checkToken, checkIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, checkToken, checkIntervalMs]);
};

export default useTokenExpiryWatcher;
