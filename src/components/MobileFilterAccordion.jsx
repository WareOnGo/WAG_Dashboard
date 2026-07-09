import React from 'react';
import { Input, Select, Slider, Collapse, Badge, Button } from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  DownOutlined,
  UpOutlined
} from '@ant-design/icons';
import './MobileFilterAccordion.css';

const { Option } = Select;

// A labelled filter control — keeps label styling + spacing identical across
// every field so the panel reads as one clean list.
const Field = ({ label, children }) => (
  <div className="mfp-field">
    <label className="mfp-field-label">{label}</label>
    {children}
  </div>
);

/**
 * MobileFilterAccordion — the mobile filter UI.
 *
 * Renders inline in the page flow (not a drawer/overlay) as a single-open
 * accordion: search + quick chips stay pinned at the top, and the grouped
 * filters expand one section at a time for a compact, thumb-friendly layout.
 * Filters apply live, so there's no explicit "apply" step. Desktop keeps using
 * WarehouseFilterBar — this component is mobile-only.
 */
const MobileFilterAccordion = ({
  searchText,
  setSearchText,
  selectedOwnerType,
  setSelectedOwnerType,
  selectedType,
  setSelectedType,
  selectedCity,
  setSelectedCity,
  selectedState,
  setSelectedState,
  selectedZone,
  setSelectedZone,
  selectedAvailability,
  setSelectedAvailability,
  selectedBroker,
  setSelectedBroker,
  fireNocFilter,
  setFireNocFilter,
  selectedLandType,
  setSelectedLandType,
  selectedUploadedBy,
  setSelectedUploadedBy,
  selectedVisibility,
  setSelectedVisibility,
  areaRange,
  setAreaRange,
  budgetRange,
  setBudgetRange,
  clearFilters,
  activeFilterCount = 0,
  // Real (server-side) count of rows matching the current filters.
  resultCount
}) => {
  const basicCount =
    (selectedOwnerType ? 1 : 0) +
    (selectedType ? 1 : 0) +
    (selectedAvailability ? 1 : 0) +
    (selectedBroker ? 1 : 0);

  const locationCount =
    (selectedCity ? 1 : 0) +
    (selectedState ? 1 : 0) +
    (selectedZone ? 1 : 0);

  const detailsCount =
    (fireNocFilter ? 1 : 0) +
    (selectedLandType ? 1 : 0) +
    (selectedUploadedBy ? 1 : 0) +
    (selectedVisibility ? 1 : 0) +
    (areaRange[0] > 0 || areaRange[1] < 100000 ? 1 : 0) +
    (budgetRange[0] > 0 || budgetRange[1] < 1000 ? 1 : 0);

  // Quick filters toggle a single value on/off (tap again to clear).
  const quickChips = [
    { key: 'fireNoc', label: 'Fire NOC', active: fireNocFilter === 'available', toggle: () => setFireNocFilter(fireNocFilter === 'available' ? '' : 'available') },
    { key: 'broker', label: 'Broker', active: selectedBroker === 'y', toggle: () => setSelectedBroker(selectedBroker === 'y' ? '' : 'y') },
    { key: 'visible', label: 'Visible', active: selectedVisibility === 'visible', toggle: () => setSelectedVisibility(selectedVisibility === 'visible' ? '' : 'visible') },
  ];

  const panelHeader = (title, count) => (
    <div className="mfp-panel-header">
      <span>{title}</span>
      {count > 0 && (
        <Badge count={count} style={{ backgroundColor: 'var(--accent-primary)', fontSize: '11px' }} />
      )}
    </div>
  );

  return (
    <div className="mobile-filter-panel">
      {/* Search — pinned at the top, always visible */}
      <Input
        placeholder="Search warehouses..."
        prefix={<SearchOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        allowClear
        className={`mfp-search ${searchText ? 'active-input' : ''}`}
      />

      {/* Quick filters */}
      <div className="mfp-quick">
        {quickChips.map((chip) => (
          <Button
            key={chip.key}
            onClick={chip.toggle}
            className={`quick-filter-chip ${chip.active ? 'quick-filter-chip--active' : 'quick-filter-chip--inactive'}`}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Grouped filters — single-open accordion */}
      <Collapse
        accordion
        defaultActiveKey="basic"
        ghost
        expandIconPosition="end"
        expandIcon={({ isActive }) => (isActive ? <UpOutlined /> : <DownOutlined />)}
      >
        <Collapse.Panel header={panelHeader('Basic', basicCount)} key="basic">
          <Field label="Owner Type">
            <Input
              placeholder="Filter by owner type"
              value={selectedOwnerType}
              onChange={(e) => setSelectedOwnerType(e.target.value)}
              allowClear
              className={selectedOwnerType ? 'active-input' : ''}
            />
          </Field>
          <Field label="Warehouse Type">
            <Input
              placeholder="Filter by warehouse type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              allowClear
              className={selectedType ? 'active-input' : ''}
            />
          </Field>
          <Field label="Availability">
            <Select
              placeholder="Filter by availability"
              value={selectedAvailability || undefined}
              onChange={(value) => setSelectedAvailability(value || '')}
              allowClear
              style={{ width: '100%' }}
              className={selectedAvailability ? 'active-input' : ''}
              popupClassName="mobile-filter-select"
            >
              <Option value="Yes">Yes</Option>
              <Option value="No">No</Option>
            </Select>
          </Field>
          <Field label="Broker Status">
            <Select
              placeholder="Select broker status"
              value={selectedBroker || undefined}
              onChange={(value) => setSelectedBroker(value || '')}
              allowClear
              style={{ width: '100%' }}
              className={selectedBroker ? 'active-input' : ''}
              popupClassName="mobile-filter-select"
            >
              <Option value="y">Yes</Option>
              <Option value="n">No</Option>
            </Select>
          </Field>
        </Collapse.Panel>

        <Collapse.Panel header={panelHeader('Location', locationCount)} key="location">
          <Field label="City">
            <Input
              placeholder="Filter by city"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              allowClear
              className={selectedCity ? 'active-input' : ''}
            />
          </Field>
          <Field label="State">
            <Input
              placeholder="Filter by state"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              allowClear
              className={selectedState ? 'active-input' : ''}
            />
          </Field>
          <Field label="Zone">
            <Select
              placeholder="Select zone"
              value={selectedZone || undefined}
              onChange={(value) => setSelectedZone(value || '')}
              allowClear
              style={{ width: '100%' }}
              className={selectedZone ? 'active-input' : ''}
              popupClassName="mobile-filter-select"
            >
              <Option value="NORTH">North</Option>
              <Option value="SOUTH">South</Option>
              <Option value="EAST">East</Option>
              <Option value="WEST">West</Option>
              <Option value="CENTRAL">Central</Option>
            </Select>
          </Field>
        </Collapse.Panel>

        <Collapse.Panel header={panelHeader('Details', detailsCount)} key="details">
          <Field label="Fire NOC">
            <Select
              placeholder="Select Fire NOC status"
              value={fireNocFilter || undefined}
              onChange={(value) => setFireNocFilter(value || '')}
              allowClear
              style={{ width: '100%' }}
              className={fireNocFilter ? 'active-input' : ''}
              popupClassName="mobile-filter-select"
            >
              <Option value="available">Available</Option>
              <Option value="not_available">Not Available</Option>
            </Select>
          </Field>
          <Field label="Land Type">
            <Input
              placeholder="Filter by land type"
              value={selectedLandType}
              onChange={(e) => setSelectedLandType(e.target.value)}
              allowClear
              className={selectedLandType ? 'active-input' : ''}
            />
          </Field>
          <Field label="Uploaded By">
            <Input
              placeholder="Filter by uploader"
              value={selectedUploadedBy}
              onChange={(e) => setSelectedUploadedBy(e.target.value)}
              allowClear
              className={selectedUploadedBy ? 'active-input' : ''}
            />
          </Field>
          <Field label="Visibility">
            <Select
              placeholder="Select visibility"
              value={selectedVisibility || undefined}
              onChange={(value) => setSelectedVisibility(value || '')}
              allowClear
              style={{ width: '100%' }}
              className={selectedVisibility ? 'active-input' : ''}
              popupClassName="mobile-filter-select"
            >
              <Option value="visible">Visible</Option>
              <Option value="hidden">Hidden</Option>
            </Select>
          </Field>
          <Field label="Area Range (sq ft)">
            <div className="mobile-filter-slider">
              <Slider
                range
                min={0}
                max={100000}
                step={1000}
                value={areaRange}
                onChange={setAreaRange}
                tooltip={{ formatter: (value) => `${value.toLocaleString()} sq ft`, placement: 'top' }}
              />
              <div className="slider-values">
                <div className={`slider-value ${areaRange[0] > 0 ? 'active' : ''}`}>{areaRange[0].toLocaleString()}</div>
                <div className="slider-value-unit">sq ft</div>
                <div className={`slider-value ${areaRange[1] < 100000 ? 'active' : ''}`}>{areaRange[1].toLocaleString()}</div>
              </div>
            </div>
          </Field>
          <Field label="Budget Range (₹/sq ft)">
            <div className="mobile-filter-slider">
              <Slider
                range
                min={0}
                max={1000}
                step={5}
                value={budgetRange}
                onChange={setBudgetRange}
                tooltip={{ formatter: (value) => `₹${value}/sq ft`, placement: 'top' }}
              />
              <div className="slider-values">
                <div className={`slider-value ${budgetRange[0] > 0 ? 'active' : ''}`}>₹{budgetRange[0]}</div>
                <div className="slider-value-unit">per sq ft</div>
                <div className={`slider-value ${budgetRange[1] < 1000 ? 'active' : ''}`}>₹{budgetRange[1]}</div>
              </div>
            </div>
          </Field>
        </Collapse.Panel>
      </Collapse>

      {/* Footer: live result count + clear all */}
      <div className="mfp-footer">
        <span className="mfp-count">
          {resultCount != null ? `${resultCount} result${resultCount !== 1 ? 's' : ''}` : ''}
        </span>
        <Button
          type="text"
          icon={<ClearOutlined />}
          onClick={clearFilters}
          disabled={activeFilterCount === 0}
          className="mfp-clear"
        >
          Clear all{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
      </div>
    </div>
  );
};

export default MobileFilterAccordion;
