import React, { useEffect } from 'react';
import { Drawer, Menu, Button, Space, Typography } from 'antd';
import {
  HomeOutlined,
  FileTextOutlined,
  MessageOutlined,
  UserOutlined,
  CloseOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';

const { Text } = Typography;

/**
 * Mobile navigation drawer component
 * Implements slide-out navigation with touch-friendly interactions
 * Requirements: 2.1, 2.3, 2.5
 */
const MobileNavigation = ({ visible, onClose }) => {
  const { isMobile } = useViewport();

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--border-radius-sm)',
            background: 'var(--glass-secondary)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            minHeight: 'var(--touch-target-min)',
          }}
          onClick={() => {
            // User profile functionality can be added here
            onClose();
          }}
        >
          <UserOutlined
            style={{
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-lg)',
            }}
          />
          <div>
            <Text
              style={{
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-base)',
                fontWeight: 500,
                display: 'block',
              }}
            >
              Admin User
            </Text>
            <Text
              style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              Administrator
            </Text>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default MobileNavigation;