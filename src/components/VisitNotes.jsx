import { useCallback, useEffect, useState } from 'react';
import { App, Button, DatePicker, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../contexts';
import { useViewport } from '../hooks/useViewport';
import { warehouseService } from '../services/warehouseService';

// ── Styles (mirror WarehouseForm) ─────────────────────────────────────────────

const labelStyle = (mobile) => ({
  display: 'block',
  marginBottom: 6,
  fontSize: mobile ? 13 : 14,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textTransform: mobile ? 'uppercase' : 'none',
  letterSpacing: mobile ? 0.5 : 0,
});
const inputBase = (mobile) => ({
  width: '100%',
  minHeight: mobile ? 44 : 36,
  padding: mobile ? '10px 14px' : '6px 11px',
  fontSize: mobile ? 16 : 14,
  background: 'var(--bg-primary, #141414)',
  border: '1px solid var(--border-primary, #303030)',
  borderRadius: 8,
  color: 'var(--text-primary, #fff)',
  outline: 'none',
  boxSizing: 'border-box',
});
const errorStyle = { color: '#ff4d4f', fontSize: 13, marginTop: 4 };

const EMPTY_DRAFT = {
  client: '',
  clientPoc: '',
  wareOnGoPoc: '',
  visitDate: '',
  clientFeedback: '',
  pocFeedback: '',
};

const formatVisitDate = (v) => {
  if (!v) return '-';
  const d = dayjs(String(v).slice(0, 10), 'YYYY-MM-DD');
  return d.isValid() ? d.format('DD MMM YYYY') : '-';
};

// ── Small form primitives ─────────────────────────────────────────────────────

const Field = ({ label, required, error, children, mobile, style }) => (
  <div style={{ marginBottom: 16, ...style }}>
    <label style={labelStyle(mobile)}>
      {label}
      {required && <span style={{ color: '#ff4d4f' }}> *</span>}
    </label>
    {children}
    {error && <div style={errorStyle}>{error}</div>}
  </div>
);

/**
 * VisitNotes — self-contained "Visit Notes" section for the warehouse view/edit
 * modals. Notes are their own resource: add/edit/delete hit the API directly and
 * are independent of the surrounding form's Save button.
 *
 * Props:
 *  - warehouseId: master warehouse id. Section renders nothing without a numeric
 *    id (create mode, staged review rows), since notes need a persisted warehouse.
 *  - editable: when true, shows the "+" add button and per-note edit/delete.
 */
const VisitNotes = ({ warehouseId, editable = false }) => {
  const { user } = useAuth();
  const { isMobile: m } = useViewport();
  const { message } = App.useApp();
  const isAdmin = !!user?.isAdmin;

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  // editingId: null (closed) | 'new' | note id being edited
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const validId = typeof warehouseId === 'number' && Number.isInteger(warehouseId) && warehouseId > 0;

  const load = useCallback(async () => {
    if (!validId) return;
    setLoading(true);
    try {
      const rows = await warehouseService.listVisitNotes(warehouseId);
      setNotes(Array.isArray(rows) ? rows : []);
    } catch {
      message.error('Failed to load visit notes');
    } finally {
      setLoading(false);
    }
  }, [warehouseId, validId, message]);

  useEffect(() => {
    setNotes([]);
    setEditingId(null);
    setErrors({});
    load();
  }, [load]);

  if (!validId) return null;

  const set = (field) => (value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setErrors({});
    setEditingId('new');
  };

  const openEdit = (note) => {
    setDraft({
      client: note.client || '',
      clientPoc: note.clientPoc || '',
      wareOnGoPoc: note.wareOnGoPoc || '',
      visitDate: note.visitDate ? String(note.visitDate).slice(0, 10) : '',
      clientFeedback: note.clientFeedback || '',
      pocFeedback: note.pocFeedback || '',
    });
    setErrors({});
    setEditingId(note.id);
  };

  const closeForm = () => {
    setEditingId(null);
    setErrors({});
  };

  const handleSave = async () => {
    const errs = {};
    if (!draft.client.trim()) errs.client = 'Client is required';
    if (!draft.visitDate) errs.visitDate = 'Date of visit is required';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    const payload = {
      client: draft.client.trim(),
      clientPoc: draft.clientPoc.trim() || null,
      wareOnGoPoc: draft.wareOnGoPoc.trim() || null,
      visitDate: draft.visitDate,
      clientFeedback: draft.clientFeedback.trim() || null,
      pocFeedback: draft.pocFeedback.trim() || null,
    };

    setSaving(true);
    try {
      if (editingId === 'new') {
        await warehouseService.createVisitNote(warehouseId, payload);
        message.success('Visit note added');
      } else {
        await warehouseService.updateVisitNote(warehouseId, editingId, payload);
        message.success('Visit note updated');
      }
      closeForm();
      await load();
    } catch (err) {
      message.error(err?.message || 'Failed to save visit note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note) => {
    setDeletingId(note.id);
    try {
      await warehouseService.deleteVisitNote(warehouseId, note.id);
      message.success('Visit note deleted');
      await load();
    } catch (err) {
      message.error(err?.message || 'Failed to delete visit note');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Renderers ──────────────────────────────────────────────────────────

  const feedbackBlock = (label, text) => (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: m ? 15 : 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
        {text || '-'}
      </div>
    </div>
  );

  const noteCard = (note) => (
    <div
      key={note.id}
      style={{
        padding: m ? 14 : 16,
        border: '1px solid var(--border-primary, #303030)',
        borderRadius: 8,
        background: 'var(--bg-secondary, transparent)',
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: m ? 15 : 14, color: 'var(--text-primary)' }}>
            {note.client}
            <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {formatVisitDate(note.visitDate)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {note.clientPoc ? `Client POC: ${note.clientPoc}` : null}
            {note.clientPoc && note.wareOnGoPoc ? ' · ' : null}
            {note.wareOnGoPoc ? `WareOnGo POC: ${note.wareOnGoPoc}` : null}
          </div>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(note)}
              title="Edit visit note"
            />
            {isAdmin && (
              <Popconfirm
                title="Delete this visit note?"
                okText="Delete"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(note)}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  loading={deletingId === note.id}
                  title="Delete visit note"
                />
              </Popconfirm>
            )}
          </div>
        )}
      </div>

      {feedbackBlock('Client Feedback', note.clientFeedback)}
      {feedbackBlock('POC Feedback', note.pocFeedback)}

      {note.createdByName && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 10, opacity: 0.75 }}>
          Added by {note.createdByName}
        </div>
      )}
    </div>
  );

  const form = (
    <div
      style={{
        padding: m ? 14 : 16,
        border: '1px dashed var(--border-primary, #303030)',
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
        <div style={{ width: m ? '100%' : 'calc(50% - 8px)' }}>
          <Field label="Client" required error={errors.client} mobile={m}>
            <input
              value={draft.client}
              onChange={(e) => set('client')(e.target.value)}
              placeholder="Client company name"
              autoComplete="off"
              style={inputBase(m)}
            />
          </Field>
        </div>
        <div style={{ width: m ? '100%' : 'calc(50% - 8px)' }}>
          <Field label="Client POC" mobile={m}>
            <input
              value={draft.clientPoc}
              onChange={(e) => set('clientPoc')(e.target.value)}
              placeholder="Client point of contact"
              autoComplete="off"
              style={inputBase(m)}
            />
          </Field>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
        <div style={{ width: m ? '100%' : 'calc(50% - 8px)' }}>
          <Field label="WareOnGo POC" mobile={m}>
            <input
              value={draft.wareOnGoPoc}
              onChange={(e) => set('wareOnGoPoc')(e.target.value)}
              placeholder="WareOnGo point of contact"
              autoComplete="off"
              style={inputBase(m)}
            />
          </Field>
        </div>
        <div style={{ width: m ? '100%' : 'calc(50% - 8px)' }}>
          <Field label="Date of Visit" required error={errors.visitDate} mobile={m}>
            <DatePicker
              value={draft.visitDate ? dayjs(draft.visitDate, 'YYYY-MM-DD') : null}
              onChange={(d) => set('visitDate')(d ? d.format('YYYY-MM-DD') : '')}
              format="DD/MM/YYYY"
              placeholder="DD/MM/YYYY"
              size={m ? 'large' : 'middle'}
              style={{
                width: '100%',
                minHeight: m ? 44 : 36,
                background: 'var(--bg-primary, #141414)',
                border: '1px solid var(--border-primary, #303030)',
                borderRadius: 8,
                fontSize: m ? 16 : 14,
              }}
              styles={{ popup: { root: { zIndex: 2000 } } }}
              allowClear
            />
          </Field>
        </div>
      </div>

      <Field label="Client Feedback" mobile={m}>
        <textarea
          value={draft.clientFeedback}
          onChange={(e) => set('clientFeedback')(e.target.value)}
          placeholder="What the client said about the site"
          rows={m ? 3 : 2}
          style={{ ...inputBase(m), resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <Field label="POC Feedback" mobile={m}>
        <textarea
          value={draft.pocFeedback}
          onChange={(e) => set('pocFeedback')(e.target.value)}
          placeholder="WareOnGo POC's observations from the visit"
          rows={m ? 3 : 2}
          style={{ ...inputBase(m), resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button onClick={closeForm} disabled={saving} style={{ minHeight: m ? 44 : 'auto' }}>
          Cancel
        </Button>
        <Button type="primary" onClick={handleSave} loading={saving} style={{ minHeight: m ? 44 : 'auto' }}>
          {editingId === 'new' ? 'Add Note' : 'Save Note'}
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      <Spin spinning={loading}>
        {notes.length === 0 && !loading && editingId === null && (
          <div style={{ fontSize: m ? 15 : 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            No visit notes yet.
          </div>
        )}

        {notes.map((note) => (editable && editingId === note.id ? form : noteCard(note)))}

        {editable && editingId === 'new' && form}

        {editable && editingId === null && (
          <Button
            icon={<PlusOutlined />}
            onClick={openAdd}
            style={{ width: m ? '100%' : 'auto', minHeight: m ? 44 : 'auto' }}
          >
            Add Visit Note
          </Button>
        )}
      </Spin>
    </div>
  );
};

export default VisitNotes;
