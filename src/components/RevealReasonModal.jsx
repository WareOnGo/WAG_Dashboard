import { useEffect, useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { InfoCircleOutlined, PhoneOutlined } from '@ant-design/icons';
import { MAX_REASON_LENGTH, MIN_REASON_LENGTH } from '../utils/revealReason';

const FONT = 'Verdana, sans-serif';

// Only start counting down near the limit — a permanent counter is noise for a
// field that usually holds a few words.
const COUNTER_VISIBLE_FROM = MAX_REASON_LENGTH - 40;

/**
 * RevealReasonModal
 *
 * Asks which deal a contact-number reveal is for. The reason travels with the API call
 * and is stored on the audit entry, so every reveal has a stated purpose.
 *
 * This is a plain rendered component rather than an antd `Modal.confirm()` call on
 * purpose: antd's static/imperative modal helpers go through the legacy ReactDOM.render
 * API that React 19 removed, so they silently do nothing here. Rendering the modal in
 * the tree works regardless.
 *
 * One prompt covers one reveal action, however many numbers it fetches — an itinerary
 * over 5 warehouses asks once and tags all 5 audit entries with the same reason, rather
 * than interrogating the user 5 times.
 *
 * @param {boolean} open - Whether the prompt is showing.
 * @param {number} count - How many numbers this reveal covers (default 1); drives the copy.
 * @param {Function} onCancel - Called when the user backs out.
 * @param {Function} onConfirm - async (reason) => void. If it rejects, the modal stays
 *   open with the error shown inline so the typed reason isn't lost.
 */
const RevealReasonModal = ({ open, count = 1, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const many = count > 1;

  // Start every prompt clean so a reason typed for one reveal is never silently
  // reused for the next one.
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
      setError('Please add which deal this is for');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err?.message || 'Could not reveal the number — please try again');
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!submitting) onCancel();
  };

  const remaining = MAX_REASON_LENGTH - reason.length;

  return (
    <Modal
      open={open}
      width={420}
      centered
      onCancel={handleCancel}
      maskClosable={!submitting}
      closable={!submitting}
      keyboard={!submitting}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: FONT }}>
          <span
            aria-hidden="true"
            style={{
              width: '30px',
              height: '30px',
              flexShrink: 0,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(24, 144, 255, 0.12)',
              color: '#1890ff',
              fontSize: '14px',
            }}
          >
            <PhoneOutlined />
          </span>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>
            {many ? `Reveal ${count} contact numbers` : 'Reveal contact number'}
          </span>
        </div>
      }
      styles={{
        content: { maxWidth: 'calc(100vw - 32px)' },
        body: { fontFamily: FONT, paddingTop: '4px' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button onClick={handleCancel} disabled={submitting} style={{ fontFamily: FONT }}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={submit}
            loading={submitting}
            style={{ fontFamily: FONT }}
          >
            {many ? `Reveal ${count} numbers` : 'Reveal number'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <label htmlFor="reveal-reason" style={labelStyle}>
          Which deal is this for?
        </label>
        {reason.length >= COUNTER_VISIBLE_FROM && (
          <span style={{ ...hintStyle, color: remaining <= 0 ? '#ff4d4f' : hintStyle.color }}>
            {remaining} left
          </span>
        )}
      </div>

      <Input.TextArea
        id="reveal-reason"
        aria-label="Reason for revealing"
        autoFocus
        value={reason}
        maxLength={MAX_REASON_LENGTH}
        disabled={submitting}
        autoSize={{ minRows: 2, maxRows: 4 }}
        placeholder={many ? 'e.g. Amazon Bhiwandi site visit' : 'e.g. Amazon Bhiwandi 40k sqft'}
        onChange={(e) => {
          setReason(e.target.value);
          if (error) setError(null);
        }}
        // Enter submits so a one-line deal name doesn't need a trip to the mouse;
        // Shift+Enter still adds a newline.
        onPressEnter={(e) => {
          if (!e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        style={{ fontFamily: FONT, fontSize: '13px' }}
      />

      {/* Error replaces the hint in place, so the modal never jumps height */}
      <div style={{ ...hintStyle, marginTop: '8px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        {error ? (
          <span style={{ color: '#ff4d4f' }}>{error}</span>
        ) : (
          <>
            <InfoCircleOutlined style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>
              {many
                ? `Saved to the audit log with your name, for all ${count} numbers.`
                : 'Saved to the audit log with your name.'}
            </span>
          </>
        )}
      </div>
    </Modal>
  );
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '13px',
  fontWeight: 500,
  color: 'rgba(255, 255, 255, 0.6)',
  fontFamily: FONT,
};

const hintStyle = {
  fontSize: '11px',
  color: 'rgba(255, 255, 255, 0.4)',
  fontFamily: FONT,
  lineHeight: 1.5,
};

export default RevealReasonModal;
