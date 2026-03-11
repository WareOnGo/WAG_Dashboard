import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography } from 'antd';
import { ClockCircleOutlined, LoginOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks';
import './SessionExpired.css';

const { Title, Text } = Typography;

/**
 * Session Expired Screen
 * Shown when the user's authentication token expires or is invalidated.
 * Provides a clear message and a single action to sign back in.
 */
const SessionExpired = () => {
  const navigate = useNavigate();
  const { isMobile } = useViewport();

  const handleSignIn = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="session-expired-container">
      <div className={`session-expired-card ${isMobile ? 'session-expired-card--mobile' : ''}`}>
        <div className="session-expired-icon">
          <ClockCircleOutlined />
        </div>

        <Title level={isMobile ? 4 : 3} className="session-expired-title">
          Session Expired
        </Title>

        <Text className="session-expired-description">
          Your session has ended due to inactivity or token expiration.
          <br />
          Please sign in again to continue using the Warehouse Portal.
        </Text>

        <Button
          type="primary"
          size={isMobile ? 'middle' : 'large'}
          icon={<LoginOutlined />}
          onClick={handleSignIn}
          className="session-expired-button"
        >
          Sign In Again
        </Button>
      </div>
    </div>
  );
};

export default SessionExpired;
