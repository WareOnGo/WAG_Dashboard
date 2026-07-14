import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DownOutlined, SearchOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';

/**
 * PocSelect — a self-contained POC picker used by the PPT modal.
 *
 * Deliberately NOT AntD's <Select>: that portals its dropdown to document.body,
 * so scrolling the list chains through to the page behind the modal. This one
 * renders the list in-flow inside the modal with its own contained scroll region
 * (overscroll-behavior: contain), so wheel/touch never reaches the background.
 *
 * Props:
 *  - pocs: Array<{ id, name, phone_number }>
 *  - loading: boolean
 *  - value: selected poc id (or undefined)
 *  - onChange: (id) => void
 *  - detailed: boolean — when true, options show name only (no number)
 *  - placeholder: string
 */
const toLocalDigits = (raw) => (raw || '').replace(/\D/g, '').slice(-10);

const PocSelect = ({ pocs = [], loading = false, value, onChange, detailed = false, placeholder = 'Select a POC' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const panelRef = useRef(null);

  const selected = pocs.find((p) => p.id === value);

  const optionLabel = (p) => (detailed ? p.name : `${p.name} · +91 ${toLocalDigits(p.phone_number)}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pocs;
    // Only match on the number when the query actually contains digits —
    // `includes('')` is always true, which used to make text queries match everyone.
    const digits = q.replace(/\D/g, '');
    return pocs.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      (digits.length > 0 && toLocalDigits(p.phone_number).includes(digits))
    );
  }, [pocs, query]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Focus the search box when opening, and scroll the whole panel into view —
  // the picker sits near the bottom of the modal's scrollable body, so without
  // this the in-flow list opens clipped behind the modal footer.
  useEffect(() => {
    if (open) {
      setQuery('');
      // Defer so the input is mounted.
      const t = setTimeout(() => {
        searchRef.current?.focus({ preventScroll: true });
        panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handlePick = (id) => {
    onChange?.(id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          height: '32px',
          padding: '4px 11px',
          borderRadius: '6px',
          border: `1px solid ${open ? '#1890ff' : '#424242'}`,
          background: '#141414',
          color: selected ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          fontSize: '14px',
          textAlign: 'left',
          transition: 'border-color 0.2s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? optionLabel(selected) : placeholder}
        </span>
        <DownOutlined style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
      </button>

      {/* In-flow dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            marginTop: '4px',
            border: '1px solid #303030',
            borderRadius: '6px',
            background: '#1f1f1f',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '8px', borderBottom: '1px solid #303030' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: '#141414', border: '1px solid #303030', borderRadius: '6px' }}>
              <SearchOutlined style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or number"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.88)',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          {/* Scrollable list — self-contained scroll, no chaining to the modal/page */}
          <div
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
            }}
          >
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
                <LoadingOutlined spin /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>
                No POCs found
              </div>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === value;
                return (
                  <div
                    key={p.id}
                    onClick={() => handlePick(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '9px 12px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: isSelected ? '#1890ff' : 'rgba(255,255,255,0.85)',
                      background: isSelected ? 'rgba(24,144,255,0.12)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {optionLabel(p)}
                    </span>
                    {isSelected && <CheckOutlined style={{ fontSize: '12px', flexShrink: 0 }} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PocSelect;
