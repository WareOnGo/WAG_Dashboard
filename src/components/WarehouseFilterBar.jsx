import { Card, Row, Col, Input, Select, Slider, Button, DatePicker } from 'antd';
import dayjs from 'dayjs';

const { Option } = Select;

// Calendar date picker, mirroring WarehouseForm's DateInput: value is a plain
// 'YYYY-MM-DD' string, displayed as DD/MM/YYYY. onChange receives '' when cleared.
const DateInput = ({ value, onChange, placeholder }) => (
  <DatePicker
    value={value ? dayjs(value, 'YYYY-MM-DD') : null}
    onChange={(d) => onChange(d ? d.format('YYYY-MM-DD') : '')}
    format="DD/MM/YYYY"
    placeholder={placeholder || 'DD/MM/YYYY'}
    style={{ width: '100%' }}
    styles={{ popup: { root: { zIndex: 2000 } } }}
    allowClear
  />
);

/**
 * WarehouseFilterBar — the desktop filter panel, shared by the dashboard and the
 * review queue. Presentational: all state lives in useWarehouseFilters, passed in
 * via the `filters` bundle.
 *
 * @param {boolean} showDateFilter - when true, render the submission/approval date
 *   filters (review queue only; staged rows carry submittedAt/reviewedAt).
 */
const WarehouseFilterBar = ({ filters, showDateFilter = false }) => {
  const {
    selectedOwnerType, setSelectedOwnerType,
    selectedType, setSelectedType,
    selectedCity, setSelectedCity,
    selectedState, setSelectedState,
    selectedZone, setSelectedZone,
    selectedAvailability, setSelectedAvailability,
    selectedBroker, setSelectedBroker,
    fireNocFilter, setFireNocFilter,
    selectedLandType, setSelectedLandType,
    selectedUploadedBy, setSelectedUploadedBy,
    selectedVisibility, setSelectedVisibility,
    areaRange, setAreaRange,
    budgetRange, setBudgetRange,
    submittedDateRange, setSubmittedDateRange,
    reviewedDateRange, setReviewedDateRange,
    clearFilters,
  } = filters;

  const labelStyle = { marginBottom: '4px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' };

  return (
    <Card
      size="small"
      style={{
        background: 'rgba(31, 31, 31, 0.4)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '16px'
      }}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Owner Type</div>
          <Input placeholder="Filter by owner type" value={selectedOwnerType}
            onChange={(e) => setSelectedOwnerType(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Warehouse Type</div>
          <Input placeholder="Filter by warehouse type" value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>City</div>
          <Input placeholder="Filter by city" value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>State</div>
          <Input placeholder="Filter by state" value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Zone</div>
          <Select placeholder="Select zone" value={selectedZone || undefined}
            onChange={setSelectedZone} allowClear style={{ width: '100%' }}>
            <Option value="NORTH">North</Option>
            <Option value="SOUTH">South</Option>
            <Option value="EAST">East</Option>
            <Option value="WEST">West</Option>
            <Option value="CENTRAL">Central</Option>
          </Select>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Availability</div>
          <Select placeholder="Filter by availability" value={selectedAvailability || undefined}
            onChange={(value) => setSelectedAvailability(value || '')} allowClear style={{ width: '100%' }}>
            <Option value="Yes">Yes</Option>
            <Option value="No">No</Option>
          </Select>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Broker Status</div>
          <Select placeholder="Select broker status" value={selectedBroker || undefined}
            onChange={setSelectedBroker} allowClear style={{ width: '100%' }}>
            <Option value="y">Y</Option>
            <Option value="n">N</Option>
          </Select>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Fire NOC</div>
          <Select placeholder="Select Fire NOC status" value={fireNocFilter || undefined}
            onChange={setFireNocFilter} allowClear style={{ width: '100%' }}>
            <Option value="available">Available</Option>
            <Option value="not_available">Not Available</Option>
          </Select>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Land Type</div>
          <Input placeholder="Filter by land type" value={selectedLandType}
            onChange={(e) => setSelectedLandType(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Uploaded By</div>
          <Input placeholder="Filter by uploader" value={selectedUploadedBy}
            onChange={(e) => setSelectedUploadedBy(e.target.value)} allowClear />
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Area Range (sq ft)</div>
          <Slider range min={0} max={100000} step={1000} value={areaRange} onChange={setAreaRange}
            tooltip={{ formatter: (value) => `${value.toLocaleString()} sq ft` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
            <span>{areaRange[0].toLocaleString()}</span>
            <span>{areaRange[1].toLocaleString()}</span>
          </div>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Budget Range (₹/sq ft)</div>
          <Slider range min={0} max={1000} step={5} value={budgetRange} onChange={setBudgetRange}
            tooltip={{ formatter: (value) => `₹${value}/sq ft` }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
            <span>₹{budgetRange[0]}</span>
            <span>₹{budgetRange[1]}</span>
          </div>
        </Col>

        <Col xs={24} sm={12} md={8} lg={6}>
          <div style={labelStyle}>Visibility</div>
          <Select placeholder="Select visibility" value={selectedVisibility || undefined}
            onChange={setSelectedVisibility} allowClear style={{ width: '100%' }}>
            <Option value="visible">Visible</Option>
            <Option value="hidden">Hidden</Option>
          </Select>
        </Col>

        {showDateFilter && (
          <>
            <Col xs={24} sm={12} md={8} lg={6}>
              <div style={labelStyle}>Submission Date (From)</div>
              <DateInput
                value={submittedDateRange[0]}
                onChange={(v) => setSubmittedDateRange([v || null, submittedDateRange[1]])}
              />
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div style={labelStyle}>Submission Date (To)</div>
              <DateInput
                value={submittedDateRange[1]}
                onChange={(v) => setSubmittedDateRange([submittedDateRange[0], v || null])}
              />
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div style={labelStyle}>Approval Date (From)</div>
              <DateInput
                value={reviewedDateRange[0]}
                onChange={(v) => setReviewedDateRange([v || null, reviewedDateRange[1]])}
              />
            </Col>

            <Col xs={24} sm={12} md={8} lg={6}>
              <div style={labelStyle}>Approval Date (To)</div>
              <DateInput
                value={reviewedDateRange[1]}
                onChange={(v) => setReviewedDateRange([reviewedDateRange[0], v || null])}
              />
            </Col>
          </>
        )}

        <Col xs={24} sm={12} md={8} lg={6}>
          <Button onClick={clearFilters} style={{ marginTop: '20px' }}>
            Clear All Filters
          </Button>
        </Col>
      </Row>
    </Card>
  );
};

export default WarehouseFilterBar;
