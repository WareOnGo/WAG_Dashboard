import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingOutlined, LockOutlined, PhoneOutlined, CheckOutlined } from '@ant-design/icons';
import { warehouseService } from '../services/warehouseService';
import { useViewport } from '../hooks';

/**
 * RedactedPhone Component
 *
 * Displays a redacted phone number button that reveals the actual number on click.
 * Each reveal triggers an API call that is audit-logged on the backend.
 *
 * @param {number} warehouseId - Used to fetch the contact number on reveal (audited).
 * @param {string} inlineContactNumber - Optional. When the caller already has the number
 *   (e.g. staged review rows, which aren't redacted), pass it here to reveal directly
 *   without an API call. Master warehouse rows are redacted server-side and omit it, so
 *   they fall back to fetching by warehouseId. Without this, staged rows would call the
 *   master /contact-number endpoint with a staged uuid id and silently fail.
 * @param {boolean} visible - Optional (default false). If true, auto-reveals on mount.
 */
const RedactedPhone = ({ warehouseId, contactNumber: inlineContactNumber = null, visible = false }) => {
  const { isMobile } = useViewport();
  const [fetchedNumber, setFetchedNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);

  const contactNumber = inlineContactNumber || fetchedNumber;

  // Reset the transient "Copied!" state on unmount so a pending timer never
  // fires against an unmounted component.
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  // Copy the revealed number to the clipboard, with a graceful fallback for
  // browsers/contexts where the async Clipboard API is unavailable.
  const handleCopy = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!contactNumber) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contactNumber);
      } else {
        const ta = document.createElement('textarea');
        ta.value = contactNumber;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Copy failed (e.g. permissions) — leave the number visible so the user
      // can still select it manually.
    }
  }, [contactNumber]);

  const fetchContactNumber = useCallback(async () => {
    // Already have a number (inline or previously fetched) — just reveal it.
    if (inlineContactNumber || fetchedNumber) {
      setRevealed(true);
      return;
    }

    setLoading(true);
    try {
      const data = await warehouseService.getContactNumber(warehouseId);
      setFetchedNumber(data.contactNumber);
      setRevealed(true);
    } catch {
      // Silently fail — button stays in redacted state
    } finally {
      setLoading(false);
    }
  }, [warehouseId, inlineContactNumber, fetchedNumber]);

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
    // Mobile: tap-to-call via a tel: link. Desktop: click-to-copy (dialing from
    // a desktop isn't useful, but copying the number is).
    if (isMobile) {
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
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Click to copy'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontSize: 'inherit',
          color: copied ? 'var(--accent-success, #52c41a)' : 'var(--accent-primary)',
          transition: 'color 0.2s ease',
        }}
      >
        {copied ? <CheckOutlined /> : <PhoneOutlined />}
        {copied ? 'Copied!' : contactNumber}
      </button>
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
