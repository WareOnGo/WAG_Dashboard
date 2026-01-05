import React, { useEffect, useState } from 'react';
import { Drawer, Menu, Button, Space, Typography, Avatar, message } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  MessageOutlined,
  UserOutlined,
  CloseOutlined,
  DashboardOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';
import { useAuth } from '../contexts/AuthContext';

const { Text } = Typography;

/**
 * Mobile navigation drawer component
 * Implements slide-out navigation with touch-friendly interactions
 * Requirements: 2.1, 2.3, 2.5, 3.5
 */
const MobileNavigation = ({ visible, onClose }) => {
  const { isMobile } = useViewport();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      message.success('Successfully logged out');
      onClose(); // Close the drawer
    } catch (error) {
      console.error('Logout error:', error);
      message.error('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Close drawer when screen size changes to desktop
  useEffect(() => {
    if (!isMobile && visible) {
      onClose();
    }
  }, [isMobile, visible, onClose]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && visible) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [visible, onClose]);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      path: '/dashboard'
    },
    {
      key: 'ppt-generator',
      icon: <FileTextOutlined />,
      label: 'PPT Generator',
      action: 'ppt-generator'
    },
    {
      key: 'chat-agent',
      icon: <MessageOutlined />,
      label: 'Chat Agent',
      action: 'chat-agent'
    }
  ];

  const handleMenuClick = ({ key }) => {
    const item = menuItems.find(item => item.key === key);
    
    if (item?.path) {
      // Handle navigation
      window.location.href = item.path;
    } else if (item?.action) {
      // Handle action buttons
      // Action handlers can be added here
    }
    
    // Close drawer after selection
    onClose();
  };

  return (
    <Drawer
      title={null}
      placement="left"
      onClose={onClose}
      open={visible}
      width={280}
      className="mobile-navigation-drawer"
      styles={{
        body: {
          padding: 0,
          background: 'var(--bg-secondary)',
        },
        header: {
          display: 'none',
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }
      }}
      style={{
        zIndex: 'var(--z-modal)',
      }}
      // Ensure drawer is only shown on mobile
      destroyOnClose={true}
      maskClosable={true}
      keyboard={true}
    >
      {/* Drawer Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-lg) var(--spacing-lg) var(--spacing-md) var(--spacing-lg)',
          borderBottom: '1px solid var(--border-secondary)',
          background: 'var(--bg-header)',
        }}
      >
        {/* Brand in drawer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Text
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 500,
            }}
          >
            WareOnGo
          </Text>
        </div>

        {/* Close button */}
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{
            minHeight: 'var(--touch-target-min)',
            minWidth: 'var(--touch-target-min)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-base)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          aria-label="Close navigation menu"
        />
      </div>

      {/* Navigation Menu */}
      <Menu
        mode="vertical"
        onClick={handleMenuClick}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 'var(--spacing-md) 0',
        }}
        className="mobile-nav-menu"
      >
        {menuItems.map((item) => (
          <Menu.Item
            key={item.key}
            icon={item.icon}
            style={{
              height: 'var(--touch-target-recommended)',
              lineHeight: 'var(--touch-target-recommended)',
              margin: 'var(--spacing-xs) var(--spacing-md)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 400,
              padding: '0 var(--spacing-md)',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu>

      {/* User Profile Section */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border-secondary)',
          background: 'var(--bg-header)',
        }}
      >
        {/* User Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--glass-secondary)',
            marginBottom: 'var(--spacing-md)',
            minHeight: 'var(--touch-target-min)',
          }}
        >
          <Avatar
            size={40}
            src={user?.picture}
            icon={<UserOutlined />}
            style={{
              backgroundColor: user?.picture ? 'transparent' : 'var(--color-primary)',
              border: '1px solid var(--border-secondary)',
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 500,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || 'User'}
            </Text>
            <Text
              style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}
            >
              {user?.email || 'user@wareongo.com'}
            </Text>
          </div>
        </div>

        {/* Logout Button */}
        <Button
          type="default"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          loading={isLoggingOut}
          block
          style={{
            minHeight: 'var(--touch-target-min)',
            borderRadius: 'var(--border-radius-sm)',
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-secondary)',
            background: 'transparent',
            transition: 'all 0.15s ease',
          }}
        >
          {isLoggingOut ? 'Signing out...' : 'Sign Out'}
        </Button>
      </div>
    </Drawer>
  );
};

export default MobileNavigation;