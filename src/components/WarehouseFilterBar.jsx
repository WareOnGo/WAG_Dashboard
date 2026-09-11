import { useId } from 'react';
import { AutoComplete, Input, InputNumber, Select, Button, DatePicker, Collapse } from 'antd';
import dayjs from 'dayjs';
import { ReloadOutlined } from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';
import { useWarehouseFilterOptions } from '../hooks/useWarehouseFilterOptions';
import './WarehouseFilterBar.css';

const AREA_INPUT_MAX = 10_000_000;
const RATE_INPUT_MAX = 10_000;

const fields = [
  ['selectedState', 'setSelectedState', 'State', 'Search states', 'common'],
  ['selectedCity', 'setSelectedCity', 'City', 'Search cities', 'common'],
  ['selectedType', 'setSelectedType', 'Warehouse Type', 'Any type', 'common'],
  ['selectedOwnerName', 'setSelectedOwnerName', 'Owner / contact name', 'Search name', 'common'],
  ['fireNocFilter', 'setFireNocFilter', 'Fire NOC', 'Any status', 'common', [['available', 'Available'], ['not_available', 'No / unknown']]],
  ['selectedAvailability', 'setSelectedAvailability', 'Availability', 'Any status', 'common', [['Yes', 'Yes'], ['No', 'No']]],
  ['selectedZone', 'setSelectedZone', 'Zone', 'Select zone', 'advanced', ['NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL'].map(v => [v, v[0] + v.slice(1).toLowerCase()])],
  ['selectedOwnerType', 'setSelectedOwnerType', 'Owner Type', 'Filter by owner type', 'advanced'],
  ['selectedBroker', 'setSelectedBroker', 'Broker Status', 'Select broker status', 'advanced', [['y', 'Yes'], ['n', 'No']]],
  ['selectedListingType', 'setSelectedListingType', 'Listing Type', 'Select listing type', 'advanced', [['Rent', 'Rent'], ['Sale', 'Sale']]],
  ['selectedStatus', 'setSelectedStatus', 'Warehouse status', 'e.g. Ready, Under construction', 'advanced'],
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
  [['areaRange', 'setAreaRange', 'Area', 'sq ft'], ['budgetRange', 'setBudgetRange', 'Budget', '₹/sq ft']].forEach(([key, setter, label, unit]) => {
    const [min, max] = filters[key];
    if (min !== 0 || max !== null) active.push({
      key, label: `${label}: ${min.toLocaleString('en-IN')}${max === null ? '+' : `–${max.toLocaleString('en-IN')}`} ${unit}`,
      clear: () => filters[setter]([0, null]),
    });
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

function RangeField({ label, unit, value, onChange, max }) {
  const update = (index, next) => {
    if (next === null) {
      onChange(index === 0 ? [0, value[1]] : [value[0], null]);
      return;
    }
    const bounded = Math.max(0, Math.min(max, next));
    onChange(index === 0 ? [Math.min(bounded, value[1] ?? max), value[1]] : [value[0], Math.max(bounded, value[0])]);
  };
  return <div className="warehouse-filters__range">
    <span className="warehouse-filters__label">{label} <span className="warehouse-filters__unit">{unit}</span></span>
    <div className="warehouse-filters__numbers">
      <label><span>Min</span><InputNumber aria-label={`Minimum ${label.toLowerCase()} (${unit})`} min={0} max={value[1] ?? max} value={value[0]} onChange={v => update(0, v)} controls={false} /></label>
      <span aria-hidden="true">–</span>
      <label><span>Max</span><InputNumber aria-label={`Maximum ${label.toLowerCase()} (${unit})`} placeholder="Any" min={value[0]} max={max} value={value[1]} onChange={v => update(1, v)} controls={false} /></label>
    </div>
  </div>;
}

export default function WarehouseFilterBar({ filters, showDateFilter = false, optionRows }) {
  const id = useId();
  const { isMobile } = useViewport();
  const suggestions = useWarehouseFilterOptions(filters.selectedState, optionRows);
  const renderField = ([key, setter, label, placeholder, , choices]) => {
    const options = key === 'selectedType' ? suggestions.warehouseTypes.map(value => [value, value]) : choices;
    const locationOptions = key === 'selectedState' ? suggestions.states : key === 'selectedCity' ? suggestions.cities : null;
    const onChange = value => {
      // Keep the city from a previous state from silently producing zero results.
      if (key === 'selectedState' && value !== filters.selectedState) filters.setSelectedCity('');
      filters[setter](value || '');
    };
    return <div className="warehouse-filters__field" key={key}>
    <label className="warehouse-filters__label" htmlFor={`${id}-${key}`}>{label}</label>
    {locationOptions ? <AutoComplete classNames={{ popup: { root: 'warehouse-filters__dropdown' } }} listItemHeight={44} popupMatchSelectWidth={isMobile ? 240 : true} id={`${id}-${key}`} placeholder={placeholder} value={filters[key]} onChange={onChange} allowClear options={locationOptions.map(value => ({ value }))} filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())} aria-describedby={`${id}-locations-hint`} />
      : options ? <Select classNames={{ popup: { root: 'warehouse-filters__dropdown' } }} listItemHeight={44} popupMatchSelectWidth={isMobile ? 240 : true} id={`${id}-${key}`} placeholder={placeholder} value={filters[key] || undefined} onChange={onChange} allowClear showSearch optionFilterProp="label" options={options.map(([value, text]) => ({ value, label: text }))} />
      : <Input id={`${id}-${key}`} placeholder={placeholder} value={filters[key]} onChange={e => filters[setter](e.target.value)} allowClear />}
  </div>;
  };
  const activeCount = appliedFilters(filters).length;
  const rangeCount = Number(filters.areaRange[0] !== 0 || filters.areaRange[1] !== null) + Number(filters.budgetRange[0] !== 0 || filters.budgetRange[1] !== null);
  const advancedCount = fields.filter(([key, , , , group]) => group === 'advanced' && filters[key]).length;
  const dateFields = [['submittedDateRange', 'setSubmittedDateRange', 'Submission Date'], ['reviewedDateRange', 'setReviewedDateRange', 'Approval Date']];
  return <section className="warehouse-filters" aria-label="Warehouse filters">
    <div className="warehouse-filters__heading">
      <strong>Refine results</strong>
      <Button type="text" size="small" icon={<ReloadOutlined />} aria-label="Clear All Filters" onClick={filters.clearFilters} disabled={!activeCount}>Reset</Button>
    </div>
    <div className="warehouse-filters__grid warehouse-filters__primary">{fields.filter(f => f[4] === 'common').map(renderField)}</div>
    <p className={`warehouse-filters__hint${!suggestions.loading && !suggestions.error ? ' warehouse-filters__hint--quiet' : ''}`} id={`${id}-locations-hint`} role="status">
      {suggestions.loading ? 'Loading location suggestions…' : suggestions.error ? <>Location suggestions unavailable. You can still type a state or city. <Button type="link" onClick={suggestions.retry}>Retry suggestions</Button></> : 'Choose a state or city from suggestions, or type to search. Changing the state clears the city.'}
    </p>
    <Collapse ghost items={[{
      key: 'ranges', label: `Area & budget${rangeCount ? ` (${rangeCount} active)` : ''}`,
      children: <div className="warehouse-filters__ranges">
        <RangeField label="Area" unit="sq ft" value={filters.areaRange} onChange={filters.setAreaRange} max={AREA_INPUT_MAX} />
        <RangeField label="Budget" unit="₹/sq ft" value={filters.budgetRange} onChange={filters.setBudgetRange} max={RATE_INPUT_MAX} />
      </div>,
    }, {
      key: 'advanced', label: `More filters${advancedCount ? ` (${advancedCount} active)` : ''}`,
      children: <div className="warehouse-filters__grid">{fields.filter(f => f[4] === 'advanced').map(renderField)}</div>,
    }, ...(showDateFilter ? [{ key: 'dates', label: 'Submission & approval dates', children: <div className="warehouse-filters__grid">{dateFields.flatMap(([key, setter, label]) => [0, 1].map(index => <div key={`${key}-${index}`} className="warehouse-filters__field"><label className="warehouse-filters__label" htmlFor={`${id}-${key}-${index}`}>{label} ({index ? 'To' : 'From'})</label><DatePicker id={`${id}-${key}-${index}`} value={filters[key][index] ? dayjs(filters[key][index]) : null} onChange={d => filters[setter](filters[key].map((v, i) => i === index ? (d ? d.format('YYYY-MM-DD') : null) : v))} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" allowClear /></div>))}</div> }] : [])]} />
  </section>;
}
