import React from 'react';
import { Layout, Typography, Button, Space } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  MessageOutlined,
  MenuOutlined
} from '@ant-design/icons';
import { useViewport } from '../hooks';

const { Header } = Layout;
const { Title } = Typography;

/**
 * Mobile-optimized header component
 * Implements responsive design with proper touch targets and mobile-first approach
 * Requirements: 2.1, 2.2, 2.4
 */
const MobileHeader = ({ onMenuToggle }) => {
  const { isMobile, isTablet } = useViewport();

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${isMobile ? 'var(--spacing-md)' : 'var(--spacing-2xl)'}`,
        height: isMobile ? '64px' : '56px',
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 'var(--z-sticky)',
        // Ensure proper safe area handling on mobile devices
        paddingTop: isMobile ? 'env(safe-area-inset-top, 0)' : '0',
      }}
      className="mobile-header"
    >
      {/* Left section - Menu button (mobile) + Brand */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-md)' 
      }}>
        {/* Hamburger menu button - only visible on mobile */}
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMenuToggle}
            className="hamburger-menu-btn"
            style={{
              minHeight: 'var(--touch-target-min)',
              minWidth: 'var(--touch-target-min)',
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--border-radius-sm)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            aria-label="Toggle navigation menu"
          />
        )}

        {/* Company Brand */}
        <a
          href="https://wareongo.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
          className="brand-link"
        >
          <Title 
            level={5} 
            style={{
              color: 'var(--text-primary)',
              margin: 0,
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: isMobile ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
              transition: 'color 0.15s ease',
            }}
          >
            WareOnGo
          </Title>
        </a>
      </div>

      {/* Right section - Action buttons + User profile */}
      <Space size={isMobile ? "small" : "medium"}>
        {/* Action buttons - responsive display */}
        {!isMobile && (
          <>
            <Button
              type="text"
              icon={<FileTextOutlined />}
              className="navbar-btn action-btn"
              size="small"
              style={{
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                transition: 'all 0.15s ease',
              }}
            >
              PPT Generator
            </Button>

            <Button
              type="text"
              icon={<MessageOutlined />}
              className="navbar-btn action-btn"
              size="small"
              style={{
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                borderRadius: 'var(--border-radius-sm)',
                color: 'var(--text-muted)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                transition: 'all 0.15s ease',
              }}
            >
              Chat Agent
            </Button>
          </>
        )}

        {/* Mobile action buttons - icon only */}
        {isMobile && (
          <>
            <Button
              type="text"
              icon={<FileTextOutlined />}
              className="navbar-btn mobile-action-btn"
              size="small"
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
              aria-label="PPT Generator"
            />

            <Button
              type="text"
              icon={<MessageOutlined />}
              className="navbar-btn mobile-action-btn"
              size="small"
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
              aria-label="Chat Agent"
            />
          </>
        )}

        {/* User profile section */}
        <div 
          className="user-profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-xs)',
            padding: isMobile ? 'var(--spacing-sm) var(--spacing-md)' : 'var(--spacing-xs) var(--spacing-sm)',
            cursor: 'pointer',
            borderRadius: 'var(--border-radius-sm)',
            transition: 'all 0.15s ease',
            minHeight: 'var(--touch-target-min)',
          }}
        >
          <UserOutlined 
            style={{ 
              color: 'var(--text-muted)', 
              fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-sm)',
            }} 
          />
          {/* Show user text on tablet and desktop, hide on small mobile */}
          {(!isMobile || isTablet) && (
            <span 
              style={{ 
                color: 'var(--text-secondary)', 
                fontSize: isMobile ? 'var(--font-size-sm)' : 'var(--font-size-xs)',
                whiteSpace: 'nowrap',
              }}
            >
              Admin User
            </span>
          )}
        </div>
      </Space>
    </Header>
  );
};

export default MobileHeader;