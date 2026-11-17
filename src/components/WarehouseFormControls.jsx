import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DatePicker, Select, Switch } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { inputBase } from '../utils/warehouseFormStyles';
import { HANDOVER_TYPE_OPTIONS, HANDOVER_UNIT_OPTIONS } from '../utils/handover';
import './WarehouseForm.css';

export const TextInput = ({ value, onChange, mobile, placeholder, type = 'text', inputMode, maxLength, autoComplete, ...rest }) => (
  <input
    type={type}
    inputMode={inputMode}
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    maxLength={maxLength}
    autoComplete={autoComplete || 'off'}
    style={inputBase(mobile)}
    {...rest}
  />
);

export const TextAreaInput = ({ value, onChange, mobile, placeholder, rows = 3, ...rest }) => (
  <textarea
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{ ...inputBase(mobile), resize: 'vertical', fontFamily: 'inherit' }}
    {...rest}
  />
);

export const SelectInput = ({ value, onChange, mobile, placeholder, options, allowClear = false, ...rest }) => {
  // Preserve free-text values that don't match a predefined option, so an
  // existing entry is shown (and not silently overwritten) in edit mode while
  // the dropdown still lets the user switch to a standard option.
  const hasCustomValue = value != null && value !== '' && !options.includes(value);
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputBase(mobile),
        appearance: 'auto',
        cursor: 'pointer',
      }}
      {...rest}
    >
      <option value="" disabled={!allowClear}>{placeholder}</option>
      {hasCustomValue && <option value={value}>{value} (current)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
};

/**
 * Dropdown multi-select rendering selected values as removable tags.
 *
 * antd's Select rather than a native <select multiple>: the native control
 * requires ctrl-click to pick more than one and gives no affordance saying so,
 * which people reliably read as "only one choice allowed".
 *
 * `value` is always an array; the caller stores exactly what the API expects.
 */
export const MultiSelectInput = ({ value, onChange, mobile, placeholder, options, ...rest }) => (
  <Select
    mode="multiple"
    allowClear
    value={Array.isArray(value) ? value : []}
    onChange={onChange}
    placeholder={placeholder}
    options={options}
    // Filter on the visible label, not the stored code — nobody is going to
    // type TRANSSHIPMENT_COURIER.
    optionFilterProp="label"
    style={{ width: '100%', minHeight: mobile ? 44 : 36 }}
    size={mobile ? 'large' : 'middle'}
    {...rest}
    maxTagCount="responsive"
  />
);

export const ComboBox = ({ value, onChange, options, placeholder, disabled, mobile, ...rest }) => {
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const hasCustomValue = value != null && value !== '' && !options.includes(value);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase()));

  const availableOptions = hasCustomValue && !query ? [value, ...filtered] : filtered;

  const select = (opt) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        onKeyDown={e => {
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
          if (e.key === 'Tab') { setOpen(false); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault(); setOpen(true);
            if (availableOptions.length) {
              const next = activeIndex < 0 ? (e.key === 'ArrowDown' ? 0 : availableOptions.length - 1) : (activeIndex + (e.key === 'ArrowDown' ? 1 : availableOptions.length - 1)) % availableOptions.length;
              setActiveIndex(next);
              document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
            }
          }
          if (e.key === 'Enter' && open && availableOptions[activeIndex]) { e.preventDefault(); select(availableOptions[activeIndex]); }
        }}
        value={open ? query : (value || '')}
        placeholder={disabled ? 'Select state first' : placeholder}
        disabled={!!disabled}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(''); setActiveIndex(-1); } }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(-1); }}
        autoComplete="off"
        style={{ ...inputBase(mobile), cursor: disabled ? 'not-allowed' : 'text' }}
        {...rest}
      />
      {open && (
        <ul id={listId} role="listbox" aria-label={placeholder} style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          maxHeight: 220, overflowY: 'auto', margin: 0, padding: '4px 0', listStyle: 'none',
          background: 'var(--bg-secondary, #1f1f1f)',
          border: '1px solid var(--border-primary, #303030)',
          borderRadius: 8,
          boxShadow: 'var(--surface-shadow, 0 4px 16px rgba(0,0,0,0.35))',
          scrollbarWidth: 'thin',
        }}>
          {hasCustomValue && !query && (
            <li
              id={`${listId}-0`}
              role="option"
              aria-selected={activeIndex === 0}
              onMouseDown={e => { e.preventDefault(); select(value); }}
              style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary, #888)', fontStyle: 'italic' }}
            >
              {value} (current)
            </li>
          )}
          {filtered.length > 0 ? filtered.map((o, index) => (
            <li
              key={o}
              id={`${listId}-${index + (hasCustomValue && !query ? 1 : 0)}`}
              role="option"
              aria-selected={activeIndex === index + (hasCustomValue && !query ? 1 : 0)}
              onMouseDown={e => { e.preventDefault(); select(o); }}
              style={{
                padding: mobile ? '11px 14px' : '8px 12px',
                fontSize: mobile ? 15 : 14,
                cursor: 'pointer',
                color: o === value ? 'var(--text-primary, #fff)' : 'var(--text-primary, #ddd)',
                fontWeight: o === value ? 700 : 400,
                background: o === value || activeIndex === index + (hasCustomValue && !query ? 1 : 0) ? 'var(--bg-hover, rgba(255,255,255,0.06))' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.06))'}
              onMouseLeave={e => e.currentTarget.style.background = o === value ? 'var(--bg-hover, rgba(255,255,255,0.06))' : 'transparent'}
            >
              {o}
            </li>
          )) : (
            <li style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary, #888)' }}>
              No matches{query ? ` for "${query}"` : ''}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export const DateInput = ({ value, onChange, mobile, placeholder, ...rest }) => {
  const [open, setOpen] = useState(false);
  // Opening the calendar must not reset an in-progress typed date to the saved value.
  const dateValue = useMemo(() => value ? dayjs(value, 'YYYY-MM-DD') : null, [value]);
  return <DatePicker
    value={dateValue}
    onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : '')}
    format="DD/MM/YYYY"
    placeholder={placeholder || 'DD/MM/YYYY'}
    size={mobile ? 'large' : 'middle'}
    {...rest}
    open={open}
    onOpenChange={setOpen}
    onBlur={event => {
      // rc-picker otherwise restores the previous date after text is deleted.
      if (value && event.target.value === '') onChange('');
    }}
    onKeyDown={event => {
      // Confirm the selected day without also submitting the warehouse form.
      if (event.key === 'Enter') event.preventDefault();
      if (!open && ['Enter', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      // The picker handles Escape; the containing modal must keep the draft open.
      if (open && event.key === 'Escape') event.stopPropagation();
    }}
    // The modal follows the visual viewport when a mobile keyboard opens.
    getPopupContainer={node => node.closest('.responsive-modal')?.firstElementChild || document.body}
    // Flip where possible, then shift into view when neither side has enough room.
    popupAlign={{ offset: [0, 0], overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true } }}
    className="wf-datepicker"
    style={{
      width: '100%',
      minHeight: mobile ? 44 : 36,
      background: 'var(--bg-primary, #141414)',
      border: '1px solid var(--border-primary, #303030)',
      borderRadius: 8,
      fontSize: mobile ? 16 : 14,
    }}
    styles={{ popup: { root: { zIndex: 2000 } } }}
    allowClear
  />;
};

export const ToggleSwitch = ({ checked, onChange, yesLabel = 'Yes', noLabel = 'No', ...rest }) => (
  <Switch
    checked={checked}
    onChange={onChange}
    {...rest}
    checkedChildren={yesLabel}
    unCheckedChildren={noLabel}
  />
);

export function OfferedAreaInput({ value, onChange, mobile, disabled = false, id, label = 'Offered Area (sq ft)', ...rest }) {
  const areas = Array.isArray(value) && value.length ? value : [''];
  return <div>
    {areas.map((area, index) => <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      <TextInput mobile={mobile} disabled={disabled} id={index === 0 ? id : undefined}
        inputMode="numeric" pattern="[0-9]*" value={area}
        onChange={text => {
          const digits = text.replace(/[^0-9]/g, '');
          onChange(areas.map((old, i) => i === index ? (digits === '' ? '' : Number(digits)) : old));
        }}
        placeholder="Enter space" data-field="totalSpaceSqft"
        style={{ ...inputBase(mobile), flex: 1, minWidth: 0 }}
        {...(index === 0 ? rest : {})} aria-label={index === 0 ? (rest['aria-label'] || label) : `${label} · Space ${index + 1}`} />
      {areas.length > 1 && <button type="button" disabled={disabled} aria-label={`Remove space value ${index + 1}`}
        onClick={() => onChange(areas.filter((_, i) => i !== index))}
        style={{ background: 'none', border: 'none', color: 'var(--text-danger, #ff4d4f)', cursor: 'pointer', fontSize: mobile ? 20 : 16, padding: 8 }}>
        <MinusCircleOutlined aria-hidden="true" />
      </button>}
    </div>)}
    <button type="button" disabled={disabled} onClick={() => onChange([...areas, ''])}
      style={{ ...inputBase(mobile), cursor: 'pointer', textAlign: 'center', borderStyle: 'dashed', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <PlusOutlined aria-hidden="true" /> Add Space Value
    </button>
  </div>;
}

// Labels match the normal form; callers translate the stored enums at the edge.
export function HandoverInput({ value, onChange, mobile, disabled = false, labelPrefix = 'Handover' }) {
  return <div role="group" aria-label={labelPrefix} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 8 }}>
    <div style={{ width: mobile ? '100%' : 120, flexShrink: 0 }}>
      <SelectInput mobile={mobile} disabled={disabled} aria-label={`${labelPrefix} mode`}
        value={value.handoverType} onChange={v => onChange('handoverType', v)} options={HANDOVER_TYPE_OPTIONS} placeholder="Mode" />
    </div>
    {value.handoverType === 'Variable' ? <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
      <div style={{ width: mobile ? '40%' : 90, flexShrink: 0 }}>
        <TextInput mobile={mobile} disabled={disabled} aria-label={`${labelPrefix} lead time`} inputMode="numeric"
          value={value.handoverLeadValue} onChange={v => onChange('handoverLeadValue', v)} placeholder="2" data-field="handoverLeadValue" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SelectInput mobile={mobile} disabled={disabled} aria-label={`${labelPrefix} unit`} value={value.handoverLeadUnit}
          onChange={v => onChange('handoverLeadUnit', v)} options={HANDOVER_UNIT_OPTIONS} placeholder="Unit" />
      </div>
    </div> : <div style={{ flex: 1, minWidth: 0 }}>
      <DateInput mobile={mobile} disabled={disabled} aria-label={`${labelPrefix} date`} value={value.handoverDate}
        onChange={v => onChange('handoverDate', v)} />
    </div>}
  </div>;
}
