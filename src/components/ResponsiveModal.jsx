import React, { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { Button, Card } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import { useVisualViewportBounds } from '../hooks/useVisualViewportBounds';
import { useRevealFocusedField } from '../hooks/useRevealFocusedField';

/**
 * ResponsiveModal Component
 * 
 * A mobile-optimized modal component that automatically adjusts sizing and behavior
 * based on viewport dimensions. Provides proper scrolling, touch-friendly controls,
 * and responsive layout patterns.
 * 
 * Features:
 * - Automatic responsive sizing with proper margins
 * - Touch-friendly close buttons and navigation controls
 * - Proper scrolling behavior for content exceeding viewport height
 * - Keyboard navigation support
 * - Safe area handling for mobile devices
 */
const ResponsiveModal = ({
  visible = false,
  onClose,
  title,
  children,
  footer,
  width = 'auto',
  maxWidth,
  height = 'auto',
  maxHeight,
  closable = true,
  maskClosable = true,
  className = '',
  style = {},
  bodyStyle = {},
  headerStyle = {},
  ...props
}) => {
  const { isMobile, isTablet } = useViewport();
  const viewport = useVisualViewportBounds(visible);
  const titleId = useId();
  const modalRef = useRef(null);
  const contentRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useRevealFocusedField(bodyRef, visible, viewport);

  // Keep keyboard focus in the topmost dialog, including nested Ant dialogs.
  // Portalled selects/date pickers are allowed to manage their own keyboard focus.
  useEffect(() => {
    if (!visible) return;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = modalRef.current;
    const visibleNode = node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    const isTopmost = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visibleNode).at(-1) === dialog;
    const inPopup = node => node instanceof Element && node.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-popover');
    const focusables = () => [...contentRef.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && visibleNode(node));
    const onKey = event => {
      if (event.defaultPrevented || !isTopmost()) return;
      if (event.key === 'Escape') {
        // An open control consumes Escape before the containing dialog does.
        if (inPopup(event.target) || event.target.closest('[aria-expanded="true"]')) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
      }
      if (event.key !== 'Tab' || inPopup(event.target)) return;
      const nodes = focusables();
      const first = nodes[0];
      const last = nodes.at(-1);
      if (!first) { event.preventDefault(); contentRef.current.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === contentRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !contentRef.current.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = event => {
      if (isTopmost() && !dialog.contains(event.target) && !inPopup(event.target)) contentRef.current?.focus({ preventScroll: true });
    };
    document.body.style.overflow = 'hidden';
    contentRef.current.focus({ preventScroll: true });
    dialog.scrollTop = 0;
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [visible]);

  if (!visible) return null;

  // Calculate responsive dimensions
  const getResponsiveDimensions = () => {
    let modalWidth = width;
    let modalMaxWidth = maxWidth;
    let modalHeight = height;
    let modalMaxHeight = maxHeight;

    if (isMobile) {
      // Full width on mobile with safe margins
      modalWidth = '100%';
      modalMaxWidth = '100%';
      modalHeight = '100%';
      modalMaxHeight = '100%';
    } else if (isTablet) {
      // Tablet sizing with comfortable margins
      modalWidth = width === 'auto' ? '90%' : width;
      modalMaxWidth = maxWidth || '700px';
      modalMaxHeight = maxHeight ? `min(${maxHeight}, 100%)` : '100%';
    } else {
      // Desktop sizing
      modalWidth = width === 'auto' ? '80%' : width;
      modalMaxWidth = maxWidth || '900px';
      modalMaxHeight = maxHeight ? `min(${maxHeight}, 100%)` : '100%';
    }

    return {
      width: modalWidth,
      maxWidth: modalMaxWidth,
      height: modalHeight,
      maxHeight: modalMaxHeight
    };
  };

  const dimensions = getResponsiveDimensions();

  // Modal overlay styles
  const overlayStyles = {
    position: 'fixed',
    top: viewport.top,
    left: viewport.left,
    width: viewport.width,
    height: viewport.height,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1000,
    overflow: 'hidden',
    // Handle safe areas on mobile devices
    padding: isMobile ? '0' : viewport.height < 500 ? '12px 20px' : '24px 20px',
    paddingTop: isMobile ? 'env(safe-area-inset-top, 0px)' : undefined,
    paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
    boxSizing: 'border-box',
    ...style
  };

  // Modal content styles
  const contentStyles = {
    width: dimensions.width,
    maxWidth: dimensions.maxWidth,
    height: dimensions.height,
    maxHeight: dimensions.maxHeight,
    background: 'var(--bg-secondary)',
    border: isMobile ? 'none' : '1px solid var(--border-primary)',
    borderRadius: isMobile ? '0' : '8px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    // Ensure modal doesn't exceed viewport on mobile
    minHeight: 0,
    // Flex-shrink 0 prevents the flex child from shrinking below its content size
    flexShrink: 0,
    // Remove focus outline
    outline: 'none'
  };

  // Header styles
  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: isMobile ? '16px' : '24px',
    borderBottom: '1px solid var(--border-primary)',
    background: 'var(--bg-secondary)',
    // Sticky header on mobile for long content
    position: isMobile ? 'sticky' : 'static',
    top: 0,
    zIndex: 10,
    flexShrink: 0,
    ...headerStyle
  };

  // Body styles
  const bodyStyles = {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    overscrollBehavior: 'contain',
    padding: isMobile ? '16px' : '24px',
    // Smooth scrolling on mobile
    WebkitOverflowScrolling: 'touch',
    ...bodyStyle
  };

  // Close button styles
  const closeButtonStyles = {
    flexShrink: 0,
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: isMobile ? '18px' : '16px',
    padding: isMobile ? '12px' : '8px'
  };

  // Handle mask click
  const handleMaskClick = (event) => {
    if (maskClosable && event.target === modalRef.current && onClose) {
      onClose();
    }
  };

  // Handle content click to prevent event bubbling
  const handleContentClick = (event) => {
    event.stopPropagation();
  };

  return createPortal(
    <div
      ref={modalRef}
      style={overlayStyles}
      onClick={handleMaskClick}
      className={`responsive-modal ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        ref={contentRef}
        style={contentStyles}
        onClick={handleContentClick}
        tabIndex={-1}
        {...props}
      >
        {/* Header */}
        {(title || closable) && (
          <div style={headerStyles}>
            {title && (
              <h3
                id={titleId}
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: isMobile ? '18px' : '20px',
                  fontWeight: 600,
                  flex: 1,
                  minWidth: 0,
                  overflowWrap: 'anywhere'
                }}
              >
                {title}
              </h3>
            )}
            {closable && (
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={onClose}
                style={closeButtonStyles}
                aria-label="Close modal"
              />
            )}
          </div>
        )}

        {/* Body */}
        <div ref={bodyRef} className="responsive-modal__body" style={bodyStyles}>
          {children}
        </div>
        {footer && (
          <div className="responsive-modal__footer" style={{
            flexShrink: 0,
            padding: isMobile ? '16px' : '24px',
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-primary)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ResponsiveModal;
