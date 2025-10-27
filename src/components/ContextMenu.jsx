import React, { useEffect, useRef } from 'react';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const ContextMenu = ({ visible, x, y, onClose, onViewDetails, onEdit, onDelete }) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  const menuStyle = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - 140),
    zIndex: 9999,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    minWidth: '140px',
    padding: '4px 0',
  };

  const menuItems = [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Details',
      onClick: () => {
        onViewDetails();
        onClose();
      }
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit',
      onClick: () => {
        onEdit();
        onClose();
      }
    },
    {
      key: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: () => {
        onDelete();
        onClose();
      }
    }
  ];

  return (
    <div ref={menuRef} style={menuStyle}>
      {menuItems.map((item, index) => {
        if (item.key === 'divider') {
          return (
            <div
              key={index}
              style={{
                height: '1px',
                background: 'var(--border-secondary)',
                margin: '4px 8px'
              }}
            />
          );
        }

        return (
          <div
            key={item.key}
            onClick={item.onClick}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: item.danger ? '#ff4d4f' : 'var(--text-secondary)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'var(--glass-hover)';
              e.target.style.color = item.danger ? '#ff4d4f' : 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent';
              e.target.style.color = item.danger ? '#ff4d4f' : 'var(--text-secondary)';
            }}
          >
            {item.icon}
            {item.label}
          </div>
        );
      })}
    </div>
  );
};

export default ContextMenu;