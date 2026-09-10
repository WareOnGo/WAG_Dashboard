import { useId } from 'react';
import { Input, InputNumber, Select, Slider, Button, DatePicker, Collapse } from 'antd';
import dayjs from 'dayjs';
import './WarehouseFilterBar.css';

// Preserve free-text matching and stored values from useWarehouseFilters.
const fields = [
  ['selectedCity', 'setSelectedCity', 'City', 'Filter by city', 'common'],
  ['selectedState', 'setSelectedState', 'State', 'Filter by state', 'common'],
  ['selectedType', 'setSelectedType', 'Warehouse Type', 'Filter by warehouse type', 'common'],
  ['selectedAvailability', 'setSelectedAvailability', 'Availability', 'Filter by availability', 'common', [['Yes', 'Yes'], ['No', 'No']]],
  ['selectedZone', 'setSelectedZone', 'Zone', 'Select zone', 'advanced', ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'].map(v => [v, v[0] + v.slice(1).toLowerCase()])],
  ['selectedOwnerType', 'setSelectedOwnerType', 'Owner Type', 'Filter by owner type', 'advanced'],
  ['selectedBroker', 'setSelectedBroker', 'Broker Status', 'Select broker status', 'advanced', [['y', 'Y'], ['n', 'N']]],
  ['fireNocFilter', 'setFireNocFilter', 'Fire NOC', 'Select Fire NOC status', 'advanced', [['available', 'Available'], ['not_available', 'Not Available']]],
  ['selectedLandType', 'setSelectedLandType', 'Land Type', 'Filter by land type', 'advanced'],
  ['selectedUploadedBy', 'setSelectedUploadedBy', 'Uploaded By', 'Filter by uploader', 'advanced'],
  ['selectedVisibility', 'setSelectedVisibility', 'Visibility', 'Select visibility', 'advanced', [['visible', 'Visible'], ['hidden', 'Hidden']]],
];

function appliedFilters(filters) {
  const active = fields.filter(([key]) => filters[key]).map(([key, setter, label, , , options]) => ({
    key, label: `${label}: ${options?.find(([value]) => value === filters[key])?.[1] || filters[key]}`,
    clear: () => filters[setter](''),
  }));
  if (filters.searchText) active.unshift({ key: 'search', label: `Search: ${filters.searchText}`, clear: () => filters.setSearchText('') });
  [['areaRange', 'setAreaRange', 'Area', 100000, 'sq ft'], ['budgetRange', 'setBudgetRange', 'Budget', 1000, '₹/sq ft']].forEach(([key, setter, label, max, unit]) => {
    if (filters[key][0] !== 0 || filters[key][1] !== max) active.push({ key, label: `${label}: ${filters[key][0].toLocaleString()}–${filters[key][1].toLocaleString()} ${unit}`, clear: () => filters[setter]([0, max]) });
  });
  [['submittedDateRange', 'setSubmittedDateRange', 'Submitted'], ['reviewedDateRange', 'setReviewedDateRange', 'Approved']].forEach(([key, setter, label]) => {
    if (filters[key]?.some(Boolean)) active.push({ key, label: `${label}: ${filters[key][0] || 'Any'} → ${filters[key][1] || 'Any'}`, clear: () => filters[setter]([null, null]) });
  });
  return active;
}

export function AppliedWarehouseFilters({ filters, resultCount, loading = false }) {
  const active = appliedFilters(filters);
  if (!active.length) return null;
  return <div className="applied-filters" aria-label="Applied filters">
    <span className="applied-filters__count" role="status">{active.length} active {active.length === 1 ? 'filter' : 'filters'}{!loading && resultCount === 0 ? ' · No matching results' : ''}</span>
    {active.map(({ key, label, clear }) => <button type="button" className="filter-chip" key={key} onClick={clear} aria-label={`Remove ${label}`}><span>{label}</span><span aria-hidden="true">×</span></button>)}
    <Button type="link" onClick={filters.clearFilters}>Clear All Filters</Button>
  </div>;
}

function RangeField({ label, unit, value, onChange, max, step }) {
  const update = (index, next) => {
    if (next === null) return;
    const bounded = Math.max(0, Math.min(max, next));
    onChange(index === 0 ? [Math.min(bounded, value[1]), value[1]] : [value[0], Math.max(bounded, value[0])]);
  };
  return <div className="warehouse-filters__range">
    <span className="warehouse-filters__label">{label} ({unit})</span>
    <div className="warehouse-filters__numbers">
      <label><span>Min</span><InputNumber aria-label={`Minimum ${label.toLowerCase()} (${unit})`} min={0} max={value[1]} value={value[0]} onChange={v => update(0, v)} controls={false} /></label>
      <span aria-hidden="true">–</span>
      <label><span>Max</span><InputNumber aria-label={`Maximum ${label.toLowerCase()} (${unit})`} min={value[0]} max={max} value={value[1]} onChange={v => update(1, v)} controls={false} /></label>
    </div>
    <Slider range min={0} max={max} step={step} value={value} onChange={onChange} ariaLabelForHandle={[`Minimum ${label.toLowerCase()}`, `Maximum ${label.toLowerCase()}`]} tooltip={{ formatter: v => `${v.toLocaleString()} ${unit}` }} />
  </div>;
}

export default function WarehouseFilterBar({ filters, showDateFilter = false }) {
  const id = useId();
  const renderField = ([key, setter, label, placeholder, , options]) => <div className="warehouse-filters__field" key={key}>
    <label className="warehouse-filters__label" htmlFor={`${id}-${key}`}>{label}</label>
    {options ? <Select id={`${id}-${key}`} placeholder={placeholder} value={filters[key] || undefined} onChange={v => filters[setter](v || '')} allowClear showSearch optionFilterProp="label" options={options.map(([value, text]) => ({ value, label: text }))} />
      : <Input id={`${id}-${key}`} placeholder={placeholder} value={filters[key]} onChange={e => filters[setter](e.target.value)} allowClear />}
  </div>;
  const advancedCount = fields.filter(([key, , , , group]) => group === 'advanced' && filters[key]).length;
  const dateFields = [['submittedDateRange', 'setSubmittedDateRange', 'Submission Date'], ['reviewedDateRange', 'setReviewedDateRange', 'Approval Date']];
  return <section className="warehouse-filters" aria-label="Warehouse filters">
    <div className="warehouse-filters__heading"><div><strong>Filter warehouses</strong><p>Results update as you refine your filters.</p></div><Button onClick={filters.clearFilters}>Clear All Filters</Button></div>
    <div className="warehouse-filters__grid">{fields.filter(f => f[4] === 'common').map(renderField)}</div>
    <div className="warehouse-filters__ranges">
      <RangeField label="Area" unit="sq ft" value={filters.areaRange} onChange={filters.setAreaRange} max={100000} step={1000} />
      <RangeField label="Budget" unit="₹/sq ft" value={filters.budgetRange} onChange={filters.setBudgetRange} max={1000} step={5} />
    </div>
    <Collapse ghost items={[{
      key: 'advanced', label: `More filters${advancedCount ? ` (${advancedCount} active)` : ''}`,
      children: <div className="warehouse-filters__grid">{fields.filter(f => f[4] === 'advanced').map(renderField)}</div>,
    }, ...(showDateFilter ? [{ key: 'dates', label: 'Submission & approval dates', children: <div className="warehouse-filters__grid">{dateFields.flatMap(([key, setter, label]) => [0, 1].map(index => <div key={`${key}-${index}`} className="warehouse-filters__field"><label className="warehouse-filters__label" htmlFor={`${id}-${key}-${index}`}>{label} ({index ? 'To' : 'From'})</label><DatePicker id={`${id}-${key}-${index}`} value={filters[key][index] ? dayjs(filters[key][index]) : null} onChange={d => filters[setter](filters[key].map((v, i) => i === index ? (d ? d.format('YYYY-MM-DD') : null) : v))} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" allowClear /></div>))}</div> }] : [])]} />
  </section>;
}
