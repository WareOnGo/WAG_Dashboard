import React, { useState, useEffect, useCallback } from 'react';
import { LoadingOutlined, LockOutlined, PhoneOutlined } from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';

/**
 * RedactedPhone Component
 *
 * Displays a redacted phone number button that reveals the actual number on click.
 * Each reveal triggers an API call that is audit-logged on the backend.
 *
 * @param {number} warehouseId - Required. Used to fetch the contact number.
 * @param {boolean} visible - Optional (default false). If true, auto-fetches and shows number on mount.
 */
const RedactedPhone = ({ warehouseId, visible = false }) => {
  const [contactNumber, setContactNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const fetchContactNumber = useCallback(async () => {
    if (contactNumber) {
      setRevealed(true);
      return;
    }

    setLoading(true);
    try {
      const data = await warehouseService.getContactNumber(warehouseId);
      setContactNumber(data.contactNumber);
      setRevealed(true);
    } catch {
      // Silently fail — button stays in redacted state
    } finally {
      setLoading(false);
    }
  }, [warehouseId, contactNumber]);

  useEffect(() => {
    if (visible) {
      fetchContactNumber();
    }
  }, [visible, fetchContactNumber]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!revealed && !loading) {
      fetchContactNumber();
    }
  };

  if (loading) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: '13px',
      }}>
        <LoadingOutlined spin /> Loading...
      </span>
    );
  }

  if (revealed && contactNumber) {
    return (
      <a
        href={`tel:${contactNumber}`}
        style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <PhoneOutlined style={{ marginRight: 4 }} />
        {contactNumber}
      </a>
    );
  }

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '20px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: 'rgba(255, 255, 255, 0.06)',
        color: 'rgba(255, 255, 255, 0.65)',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '1.4',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }}
    >
      <LockOutlined /> Show Number
    </button>
  );
};

export default React.memo(RedactedPhone);
