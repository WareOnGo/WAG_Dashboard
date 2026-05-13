import { useState, useEffect, useCallback } from 'react';
import { Button, Switch, Spin, Tooltip } from 'antd';
import { SaveOutlined, PlusOutlined, MinusCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import ResponsiveModal from './ResponsiveModal';
import './ResponsiveModal.css';
import './WarehouseForm.css';
import { clearErrors } from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';
import { getMediaFromWarehouse } from '../utils/mediaUtils';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

const ZONES = ['North', 'South', 'East', 'West', 'Central'];
const LAND_TYPES = ['Commercial', 'Industrial', 'Others'];
const POLLUTION_ZONES = ['Green', 'Orange', 'Red', 'White'];
const BROKER_OPTIONS = ['Yes', 'No'];

const INITIAL_VALUES = {
  warehouseOwnerType: '', warehouseType: '', zone: '', address: '',
  city: '', state: '', postalCode: '', googleLocation: '',
  contactPerson: '', contactNumber: '',
  totalSpaceSqft: [1000], ratePerSqft: '', offeredSpaceSqft: '', numberOfDocks: '',
  clearHeightFt: '', availability: '', isBroker: '', uploadedBy: '',
  visibility: true, compliances: '', otherSpecifications: '',
  latitude: '', longitude: '', fireNocAvailable: false,
  fireSafetyMeasures: '', landType: '', approachRoadWidth: '',
  powerKva: '', pollutionZone: '', vaastuCompliance: false,
  dimensions: '', parkingDockingSpace: '', photos: '', media: null,
  // Newly added fields
  listing_type: '',
  alt_phone_number: '', land_parcel_size: '', builtup_area: '',
  owner_warmnth: '', distance_from_highway: '', is_builder: false,
  owner_of_multiple_sites: '', carpet_area: '', nearest_transport: '',
  fire_exits: '', fire_compliance_cert_type: '',
  negotiated_rent: '', washroom_count: '',
  ownerCompanyName: '', ownerAltPoc: '',
  gateSizeFt: '', dockApronLengthFt: '', setbackArea: '', ccRoads: '',
  wallAndSecurityRoom: '', plinthHeightFt: '',
  dockDimension: '', canopyType: '', dockPlatformType: '', otherDockingSpecs: '',
  flooringType: '', floorStrengthPerSqm: '', ventilationType: '',
  ventilationAirChangesPerDay: '', insulationPresent: '', insulationType: '',
  lightingDetails: '', wogVerified: false, centreHeight: '',
};

/** Flatten initialData (including nested WarehouseData) into form shape */
const toFormValues = (d) => {
  if (!d) return { ...INITIAL_VALUES };
  const wd = d.WarehouseData || d.warehouseData || {};
  return {
    warehouseOwnerType: d.warehouseOwnerType || '',
    warehouseType: d.warehouseType || '',
    zone: d.zone || '',
    address: d.address || '',
    city: d.city || '',
    state: d.state || '',
    postalCode: d.postalCode || '',
    googleLocation: d.googleLocation || '',
    contactPerson: d.contactPerson || '',
    contactNumber: d.contactNumber || '',
    totalSpaceSqft: Array.isArray(d.totalSpaceSqft)
      ? d.totalSpaceSqft
      : d.totalSpaceSqft ? [d.totalSpaceSqft] : [1000],
    ratePerSqft: d.ratePerSqft ?? '',
    offeredSpaceSqft: d.offeredSpaceSqft ?? '',
    numberOfDocks: d.numberOfDocks ?? '',
    clearHeightFt: d.clearHeightFt ?? '',
    availability: d.availability || '',
    isBroker: d.isBroker || '',
    uploadedBy: d.uploadedBy || '',
    visibility: d.visibility === true || d.visibility === 'true' || d.visibility === 1,
    compliances: d.compliances || '',
    otherSpecifications: d.otherSpecifications || '',
    latitude: wd.latitude ?? '',
    longitude: wd.longitude ?? '',
    fireNocAvailable: wd.fireNocAvailable === true || wd.fireNocAvailable === 'true',
    fireSafetyMeasures: wd.fireSafetyMeasures || '',
    landType: wd.landType || '',
    approachRoadWidth: wd.approachRoadWidth ?? '',
    powerKva: wd.powerKva ?? '',
    pollutionZone: wd.pollutionZone || '',
    vaastuCompliance: wd.vaastuCompliance === true || wd.vaastuCompliance === 'true',
    dimensions: wd.dimensions || '',
    parkingDockingSpace: wd.parkingDockingSpace || '',
    photos: d.photos || '',
    media: getMediaFromWarehouse(d),
    // Newly added fields
    listing_type: d.listing_type || '',
    alt_phone_number: d.alt_phone_number || '',
    land_parcel_size: d.land_parcel_size || '',
    builtup_area: d.builtup_area || '',
    owner_warmnth: d.owner_warmnth || '',
    distance_from_highway: d.distance_from_highway || '',
    is_builder: d.is_builder === true || d.is_builder === 'true',
    owner_of_multiple_sites: d.owner_of_multiple_sites || '',
    carpet_area: d.carpet_area || '',
    nearest_transport: d.nearest_transport || '',
    fire_exits: d.fire_exits || '',
    fire_compliance_cert_type: d.fire_compliance_cert_type || '',
    negotiated_rent: d.negotiated_rent || '',
    washroom_count: d.washroom_count || '',
    ownerCompanyName: d.ownerCompanyName || '',
    ownerAltPoc: d.ownerAltPoc || '',
    gateSizeFt: d.gateSizeFt || '',
    dockApronLengthFt: d.dockApronLengthFt || '',
    setbackArea: d.setbackArea || '',
    ccRoads: d.ccRoads || '',
    wallAndSecurityRoom: d.wallAndSecurityRoom || '',
    plinthHeightFt: d.plinthHeightFt || '',
    dockDimension: d.dockDimension || '',
    canopyType: d.canopyType || '',
    dockPlatformType: d.dockPlatformType || '',
    otherDockingSpecs: d.otherDockingSpecs || '',
    flooringType: d.flooringType || '',
    floorStrengthPerSqm: d.floorStrengthPerSqm || '',
    ventilationType: d.ventilationType || '',
    ventilationAirChangesPerDay: d.ventilationAirChangesPerDay || '',
    insulationPresent: d.insulationPresent || '',
    insulationType: d.insulationType || '',
    lightingDetails: d.lightingDetails || '',
    wogVerified: d.wogVerified === true || d.wogVerified === 'true',
    centreHeight: d.centreHeight || '',
  };
};

// ── Shared inline styles ──────────────────────────────────────────────────────

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
const sectionTitle = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '24px 0 16px' };

// ── Reusable field components ─────────────────────────────────────────────────

const Field = ({ label, required, error, children, style, mobile, tooltip }) => (
  <div style={{ marginBottom: 20, ...style }}>
    {label && (
      <label style={labelStyle(mobile)}>
        {label}
        {required && <span style={{ color: '#ff4d4f' }}> *</span>}
        {tooltip && (
          <Tooltip title={tooltip} placement="top">
            <QuestionCircleOutlined
              style={{
                marginLeft: 6,
                color: 'var(--text-secondary, #888)',
                cursor: 'help',
                fontSize: mobile ? 13 : 13,
              }}
            />
          </Tooltip>
        )}
      </label>
    )}
    {children}
    {error && <div style={errorStyle}>{error}</div>}
  </div>
);

const TextInput = ({ value, onChange, mobile, placeholder, type = 'text', inputMode, maxLength, autoComplete, ...rest }) => (
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

const TextAreaInput = ({ value, onChange, mobile, placeholder, rows = 3 }) => (
  <textarea
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    style={{ ...inputBase(mobile), resize: 'vertical', fontFamily: 'inherit' }}
  />
);

const SelectInput = ({ value, onChange, mobile, placeholder, options }) => (
  <select
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    style={{
      ...inputBase(mobile),
      appearance: 'auto',
      cursor: 'pointer',
    }}
  >
    <option value="" disabled>{placeholder}</option>
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
);

const ToggleSwitch = ({ checked, onChange, yesLabel = 'Yes', noLabel = 'No' }) => (
  <Switch
    checked={checked}
    onChange={onChange}
    checkedChildren={yesLabel}
    unCheckedChildren={noLabel}
  />
);

const Section = ({ title, children }) => (
  <div>
    <div style={sectionTitle}>{title}</div>
    {children}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const WarehouseForm = ({ visible, onCancel, onSubmit, initialData = null, loading = false }) => {
  const { isMobile } = useViewport();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [contactTouched, setContactTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      setValues(toFormValues(initialData));
      setErrors({});
      setInitialSnapshot(initialData);
      setContactTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Patch in background-fetched contact number without resetting the form
  useEffect(() => {
    if (visible && !contactTouched && initialData && initialSnapshot &&
      initialData.id === initialSnapshot.id &&
      initialData.contactNumber !== initialSnapshot.contactNumber) {
      setValues(prev => ({ ...prev, contactNumber: initialData.contactNumber || prev.contactNumber }));
      setInitialSnapshot(initialData);
    }
  }, [visible, initialData, initialSnapshot, contactTouched]);

  const set = (field) => (val) => {
    setValues(prev => ({ ...prev, [field]: val }));
    if (field === 'contactNumber') setContactTouched(true);
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e = {};
    if (!values.listing_type) e.listing_type = 'Listing type is required';
    if (!values.warehouseType?.trim()) e.warehouseType = 'Warehouse type is required';
    if (!values.zone) e.zone = 'Zone is required';
    if (!values.address?.trim()) e.address = 'Address is required';
    if (!values.city?.trim()) e.city = 'City is required';
    if (!values.state?.trim()) e.state = 'State is required';
    if (!values.contactPerson?.trim()) e.contactPerson = 'Contact person is required';
    if (!values.contactNumber?.trim()) e.contactNumber = 'Contact number is required';
    const spaces = (values.totalSpaceSqft || []).filter(v => v != null && v > 0);
    if (spaces.length === 0) e.totalSpaceSqft = 'At least one space value is required';
    if (!values.ratePerSqft && values.ratePerSqft !== 0) e.ratePerSqft = 'Rate per sq ft is required';
    if (!values.uploadedBy?.trim()) e.uploadedBy = 'Uploaded by is required';
    if (!values.compliances) e.compliances = 'Compliance info is required';

    // Latitude and longitude validation removed to support high precision formats

    setErrors(e);

    // Scroll to first error on mobile
    if (Object.keys(e).length > 0) {
      const firstKey = Object.keys(e)[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstKey}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }

    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Build media from form state (the FileUpload now manages a media object)
      const media = values.media || { images: [], videos: [], docs: [] };
      const hasMedia = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0) > 0;

      // Double-write: flatten media back to photos CSV for legacy column
      const allUrls = [...(media.images || []), ...(media.videos || []), ...(media.docs || [])];
      const photosValue = allUrls.length > 0 ? allUrls.join(',') : null;

      const payload = {
        warehouseOwnerType: values.warehouseOwnerType || null,
        warehouseType: values.warehouseType,
        address: values.address,
        googleLocation: values.googleLocation || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode || null,
        zone: values.zone,
        contactPerson: values.contactPerson,
        contactNumber: values.contactNumber,
        totalSpaceSqft: (values.totalSpaceSqft || []).filter(v => v != null && v > 0),
        offeredSpaceSqft: values.offeredSpaceSqft ? String(values.offeredSpaceSqft) : null,
        numberOfDocks: values.numberOfDocks ? String(values.numberOfDocks) : null,
        clearHeightFt: values.clearHeightFt ? String(values.clearHeightFt) : null,
        compliances: values.compliances,
        otherSpecifications: values.otherSpecifications || null,
        ratePerSqft: values.ratePerSqft ? String(values.ratePerSqft) : null,
        availability: values.availability || null,
        uploadedBy: values.uploadedBy,
        visibility: Boolean(values.visibility),
        isBroker: values.isBroker || null,
        photos: photosValue,
        media: hasMedia ? media : null,
        // Newly added fields (all optional)
        listing_type: values.listing_type || null,
        alt_phone_number: values.alt_phone_number || null,
        land_parcel_size: values.land_parcel_size || null,
        builtup_area: values.builtup_area || null,
        owner_warmnth: values.owner_warmnth || null,
        distance_from_highway: values.distance_from_highway || null,
        is_builder: typeof values.is_builder === 'boolean' ? values.is_builder : null,
        owner_of_multiple_sites: values.owner_of_multiple_sites || null,
        carpet_area: values.carpet_area || null,
        nearest_transport: values.nearest_transport || null,
        fire_exits: values.fire_exits || null,
        fire_compliance_cert_type: values.fire_compliance_cert_type || null,
        negotiated_rent: values.negotiated_rent || null,
        washroom_count: values.washroom_count || null,
        ownerCompanyName: values.ownerCompanyName || null,
        ownerAltPoc: values.ownerAltPoc || null,
        gateSizeFt: values.gateSizeFt || null,
        dockApronLengthFt: values.dockApronLengthFt || null,
        setbackArea: values.setbackArea || null,
        ccRoads: values.ccRoads || null,
        wallAndSecurityRoom: values.wallAndSecurityRoom || null,
        plinthHeightFt: values.plinthHeightFt || null,
        dockDimension: values.dockDimension || null,
        canopyType: values.canopyType || null,
        dockPlatformType: values.dockPlatformType || null,
        otherDockingSpecs: values.otherDockingSpecs || null,
        flooringType: values.flooringType || null,
        floorStrengthPerSqm: values.floorStrengthPerSqm || null,
        ventilationType: values.ventilationType || null,
        ventilationAirChangesPerDay: values.ventilationAirChangesPerDay || null,
        insulationPresent: values.insulationPresent || null,
        insulationType: values.insulationType || null,
        lightingDetails: values.lightingDetails || null,
        wogVerified: typeof values.wogVerified === 'boolean' ? values.wogVerified : null,
        centreHeight: values.centreHeight || null,
        warehouseData: {
          latitude: values.latitude || null,
          longitude: values.longitude || null,
          fireNocAvailable: Boolean(values.fireNocAvailable),
          fireSafetyMeasures: values.fireSafetyMeasures || null,
          landType: values.landType || null,
          approachRoadWidth: values.approachRoadWidth ? String(values.approachRoadWidth) : null,
          dimensions: values.dimensions || null,
          parkingDockingSpace: values.parkingDockingSpace || null,
          pollutionZone: values.pollutionZone || null,
          powerKva: values.powerKva ? String(values.powerKva) : null,
          vaastuCompliance: values.vaastuCompliance ? 'true' : null,
        },
      };

      await onSubmit(payload);
      setValues(INITIAL_VALUES);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    setValues(INITIAL_VALUES);
    setErrors({});
    clearErrors();
    onCancel();
  }, [onCancel]);

  // ── totalSpaceSqft list helpers ─────────────────────────────────────────────

  const addSpace = () => set('totalSpaceSqft')([...(values.totalSpaceSqft || []), '']);
  const removeSpace = (i) => set('totalSpaceSqft')(values.totalSpaceSqft.filter((_, idx) => idx !== i));
  const setSpace = (i, v) => {
    const next = [...values.totalSpaceSqft];
    next[i] = v === '' ? '' : Number(v);
    set('totalSpaceSqft')(next);
  };

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const m = isMobile;
  const row = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
      {children}
    </div>
  );
  const col = (children, half = false) => (
    <div style={{ width: (half && !m) ? 'calc(50% - 8px)' : '100%' }}>
      {children}
    </div>
  );

  if (!visible) return null;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={handleCancel}
      title={initialData ? 'Edit Warehouse' : 'Create New Warehouse'}
      maxWidth="900px"
      className="warehouse-form-modal"
    >
      <Spin
        spinning={loading || submitting}
        tip={<div style={{ color: 'var(--text-primary)', fontSize: m ? 16 : 14, marginTop: 8 }}>
          {submitting ? 'Saving warehouse...' : 'Loading...'}
        </div>}
        size={m ? 'large' : 'default'}
      >
        <form onSubmit={handleSubmit} style={{ color: 'var(--text-primary)' }}>

          {/* ── Owner Details ───────────────────────────────────── */}
          <Section title="Owner Details">
            {row(<>
              {col(
                <Field label="Listing Type" required error={errors.listing_type}>
                  <SelectInput mobile={m} value={values.listing_type} onChange={set('listing_type')} placeholder="Select listing type" options={['Rent', 'Sale']} data-field="listing_type" />
                </Field>,
                true)}
              {col(
                <Field label="Warehouse Owner Type">
                  <TextInput mobile={m} value={values.warehouseOwnerType} onChange={set('warehouseOwnerType')} placeholder="Owner, Tenant, Broker, etc." data-field="warehouseOwnerType" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Owner Company Name" tooltip="Please specify details of company / 3PL.">
                  <TextInput mobile={m} value={values.ownerCompanyName} onChange={set('ownerCompanyName')} placeholder="Company name" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Contact Person" required error={errors.contactPerson}>
                  <TextInput mobile={m} value={values.contactPerson} onChange={set('contactPerson')} placeholder="Contact person name" autoComplete="name" data-field="contactPerson" />
                </Field>,
                true)}
              {col(
                <Field label="Contact Number" required error={errors.contactNumber}>
                  <TextInput mobile={m} value={values.contactNumber} onChange={set('contactNumber')} placeholder="10-digit phone number" type="tel" inputMode="tel" maxLength={15} autoComplete="tel" data-field="contactNumber" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Alternate Phone Number">
                  <TextInput mobile={m} value={values.alt_phone_number} onChange={set('alt_phone_number')} placeholder="Alternate phone" type="tel" inputMode="tel" maxLength={15} />
                </Field>,
                true)}
              {col(
                <Field label="Owner Alternate POC">
                  <TextInput mobile={m} value={values.ownerAltPoc} onChange={set('ownerAltPoc')} placeholder="Alternate point of contact" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Is Broker">
                  <SelectInput mobile={m} value={values.isBroker} onChange={set('isBroker')} placeholder="Select" options={BROKER_OPTIONS} />
                </Field>,
                true)}
              {col(
                <Field label="Is Builder">
                  <ToggleSwitch checked={values.is_builder} onChange={set('is_builder')} />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Owner Warmth" tooltip="Rate based on the owner's collaborativeness.">
                  <TextInput mobile={m} value={values.owner_warmnth} onChange={set('owner_warmnth')} placeholder="Cold, Warm, Hot, etc." />
                </Field>,
                true)}
              {col(
                <Field label="Owner of Multiple Sites">
                  <TextInput mobile={m} value={values.owner_of_multiple_sites} onChange={set('owner_of_multiple_sites')} placeholder="Yes / No / details" />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Uploaded By" required error={errors.uploadedBy} tooltip="Mention your name.">
                  <TextInput mobile={m} value={values.uploadedBy} onChange={set('uploadedBy')} placeholder="Uploader name" data-field="uploadedBy" />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Location Details ────────────────────────────────── */}
          <Section title="Location Details">
            <Field label="Address" required error={errors.address} tooltip="Please mention the locality, but not the exact address.">
              <TextAreaInput mobile={m} value={values.address} onChange={set('address')} placeholder="Enter complete address" rows={m ? 3 : 2} data-field="address" />
            </Field>

            {row(<>
              {col(
                <Field label="City" required error={errors.city}>
                  <TextInput mobile={m} value={values.city} onChange={set('city')} placeholder="Enter city" autoComplete="address-level2" data-field="city" />
                </Field>,
                true)}
              {col(
                <Field label="State" required error={errors.state}>
                  <TextInput mobile={m} value={values.state} onChange={set('state')} placeholder="Enter state" autoComplete="address-level1" data-field="state" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Postal Code">
                  <TextInput mobile={m} value={values.postalCode} onChange={set('postalCode')} placeholder="Postal code" inputMode="numeric" autoComplete="postal-code" />
                </Field>,
                true)}
              {col(
                <Field label="Zone" required error={errors.zone}>
                  <SelectInput mobile={m} value={values.zone} onChange={set('zone')} placeholder="Select zone" options={ZONES} data-field="zone" />
                </Field>,
                true)}
            </>)}

            <Field label="Google Location URL">
              <TextInput mobile={m} value={values.googleLocation} onChange={set('googleLocation')} placeholder="Google Maps URL" type="url" />
            </Field>

            {row(<>
              {col(
                <Field label="Latitude" error={errors.latitude}>
                  <TextInput mobile={m} value={values.latitude} onChange={set('latitude')} placeholder="Enter latitude" />
                </Field>,
                true)}
              {col(
                <Field label="Longitude" error={errors.longitude}>
                  <TextInput mobile={m} value={values.longitude} onChange={set('longitude')} placeholder="Enter longitude" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Nearest Bus Transport" tooltip="Please mention the nearest bus stop and its distance.">
                  <TextInput mobile={m} value={values.nearest_transport} onChange={set('nearest_transport')} placeholder="Nearest bus stand / depot" />
                </Field>,
                true)}
              {col(
                <Field label="Distance from Highway">
                  <TextInput mobile={m} value={values.distance_from_highway} onChange={set('distance_from_highway')} placeholder="e.g. 2 km" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Approach Road Width (ft)">
                  <TextInput mobile={m} value={values.approachRoadWidth} onChange={set('approachRoadWidth')} placeholder="Road width" />
                </Field>,
                true)}
              {col(
                <Field label="Land Type">
                  <SelectInput mobile={m} value={values.landType} onChange={set('landType')} placeholder="Select land type" options={LAND_TYPES} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Pollution Zone">
                  <SelectInput mobile={m} value={values.pollutionZone} onChange={set('pollutionZone')} placeholder="Select pollution zone" options={POLLUTION_ZONES} />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Warehouse Technical Specifications ──────────────── */}
          <Section title="Warehouse Technical Specifications">
            {row(<>
              {col(
                <Field label="Warehouse Type" required error={errors.warehouseType} tooltip="Please mention PEB / RCC / Shed. Use 'Shed' for old-style godowns.">
                  <TextInput mobile={m} value={values.warehouseType} onChange={set('warehouseType')} placeholder="PEB/RCC/Shed" data-field="warehouseType" />
                </Field>,
                true)}
              {col(
                /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
                <Field label="Offered Area (sq ft)" required error={errors.totalSpaceSqft} tooltip="Please mention all kinds of areas offered.">
                  {(values.totalSpaceSqft || []).map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={v ?? ''}
                        onChange={e => setSpace(i, e.target.value)}
                        placeholder="Enter space"
                        min={1}
                        style={{ ...inputBase(m), flex: 1 }}
                        data-field="totalSpaceSqft"
                      />
                      {values.totalSpaceSqft.length > 1 && (
                        <button type="button" onClick={() => removeSpace(i)}
                          style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: m ? 20 : 16, padding: 8 }}>
                          <MinusCircleOutlined />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addSpace}
                    style={{ ...inputBase(m), cursor: 'pointer', textAlign: 'center', borderStyle: 'dashed', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <PlusOutlined /> Add Space Value
                  </button>
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Land Parcel Size" tooltip="Please mention the entire parcel size.">
                  <TextInput mobile={m} value={values.land_parcel_size} onChange={set('land_parcel_size')} placeholder="e.g. 5 acres" />
                </Field>,
                true)}
              {col(
                <Field label="Built-up Area" tooltip="Please mention the entire compound's built-up area.">
                  <TextInput mobile={m} value={values.builtup_area} onChange={set('builtup_area')} placeholder="Built-up area" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Carpet Area" tooltip="Please mention the entire carpet area.">
                  <TextInput mobile={m} value={values.carpet_area} onChange={set('carpet_area')} placeholder="Carpet area" />
                </Field>,
                true)}
              {col(
                <Field label="Dimensions">
                  <TextInput mobile={m} value={values.dimensions} onChange={set('dimensions')} placeholder="Warehouse dimensions" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Clear Height (ft)" tooltip="Please mention the side height here.">
                  <TextInput mobile={m} value={values.clearHeightFt} onChange={set('clearHeightFt')} placeholder="Clear Height / Side Height" />
                </Field>,
                true)}
              {col(
                <Field label="Centre Height">
                  <TextInput mobile={m} value={values.centreHeight} onChange={set('centreHeight')} placeholder="Centre height" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Plinth Height (ft)">
                  <TextInput mobile={m} value={values.plinthHeightFt} onChange={set('plinthHeightFt')} placeholder="Plinth height" />
                </Field>,
                true)}
              {col(
                <Field label="Number of Docks">
                  <TextInput mobile={m} value={values.numberOfDocks} onChange={set('numberOfDocks')} placeholder="Number of docks" />
                </Field>,
                true)}
              {col(
                <Field label="Dock Dimension">
                  <TextInput mobile={m} value={values.dockDimension} onChange={set('dockDimension')} placeholder="e.g. 8x10" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Dock Apron Length (ft)" tooltip="Please mention the distance from the wall to the dock platform.">
                  <TextInput mobile={m} value={values.dockApronLengthFt} onChange={set('dockApronLengthFt')} placeholder="Apron length" />
                </Field>,
                true)}
              {col(
                <Field label="Dock Platform Type" tooltip="None / Dock Platform / Running Platform.">
                  <TextInput mobile={m} value={values.dockPlatformType} onChange={set('dockPlatformType')} placeholder="None/Extended Platform/Running Platform/Cross Dock" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Gate Size (ft)">
                  <TextInput mobile={m} value={values.gateSizeFt} onChange={set('gateSizeFt')} placeholder="Gate size" />
                </Field>,
                true)}
              {col(
                <Field label="Setback Area">
                  <TextInput mobile={m} value={values.setbackArea} onChange={set('setbackArea')} placeholder="Setback area" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="CC Roads">
                  <TextInput mobile={m} value={values.ccRoads} onChange={set('ccRoads')} placeholder="Yes / No" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Wall & Security Room">
                  <TextInput mobile={m} value={values.wallAndSecurityRoom} onChange={set('wallAndSecurityRoom')} placeholder="Yes / No / details" />
                </Field>,
                true)}
              {col(
                <Field label="Canopy Type" tooltip="Dock canopy vs running canopy.">
                  <TextInput mobile={m} value={values.canopyType} onChange={set('canopyType')} placeholder="Running/Shutter/None" />
                </Field>,
                true)}
            </>)}

            <Field label="Other Docking Specs" tooltip="Please mention if cross docks, levellers, or other specs are present.">
              <TextAreaInput mobile={m} value={values.otherDockingSpecs} onChange={set('otherDockingSpecs')} placeholder="Other docking specifications" rows={m ? 3 : 2} />
            </Field>

            {row(<>
              {col(
                <Field label="Flooring Type" tooltip="E.g. VDF / FM2.">
                  <TextInput mobile={m} value={values.flooringType} onChange={set('flooringType')} placeholder="VDF/FM2" />
                </Field>,
                true)}
              {col(
                <Field label="Floor Strength (per sqm)">
                  <TextInput mobile={m} value={values.floorStrengthPerSqm} onChange={set('floorStrengthPerSqm')} placeholder="e.g. 5 T/sqm" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Ventilation Type" tooltip="Ridge / Turbo / Side Louvers / Windows. Fill what is relevant.">
                  <TextInput mobile={m} value={values.ventilationType} onChange={set('ventilationType')} placeholder="Ridge/Turbo" />
                </Field>,
                true)}
              {col(
                <Field label="Ventilation Air Changes/Day">
                  <TextInput mobile={m} value={values.ventilationAirChangesPerDay} onChange={set('ventilationAirChangesPerDay')} placeholder="Air changes per day" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Insulation Present">
                  <TextInput mobile={m} value={values.insulationPresent} onChange={set('insulationPresent')} placeholder="Yes / No" />
                </Field>,
                true)}
              {col(
                <Field label="Insulation Type">
                  <TextInput mobile={m} value={values.insulationType} onChange={set('insulationType')} placeholder="Insulation type" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field label="Lighting Details" tooltip="Please mention LUX level, else the type of lighting provided.">
                  <TextInput mobile={m} value={values.lightingDetails} onChange={set('lightingDetails')} placeholder="Lux Level" />
                </Field>,
                true)}
              {col(
                <Field label="Washroom Count">
                  <TextInput mobile={m} value={values.washroom_count} onChange={set('washroom_count')} placeholder="Number of washrooms" />
                </Field>,
                true)}
            </>)}

            <Field label="Parking & Docking Space">
              <TextAreaInput mobile={m} value={values.parkingDockingSpace} onChange={set('parkingDockingSpace')} placeholder="Parking and docking space details" rows={m ? 3 : 2} />
            </Field>

            {row(
              col(
                <Field label="Power (KVA)">
                  <TextInput mobile={m} value={values.powerKva} onChange={set('powerKva')} placeholder="Power in KVA" />
                </Field>,
                true)
            )}

            <Field label="Other Specifications">
              <TextAreaInput mobile={m} value={values.otherSpecifications} onChange={set('otherSpecifications')} placeholder="Other specifications" rows={m ? 3 : 2} />
            </Field>
          </Section>

          {/* ── Compliances ─────────────────────────────────────── */}
          <Section title="Compliances">
            <Field label="Compliances" required error={errors.compliances} tooltip="Please only mention conversion-related and Fire NOC-related status.">
              <TextAreaInput mobile={m} value={values.compliances} onChange={set('compliances')} placeholder="Compliance details" rows={m ? 3 : 2} />
            </Field>

            {row(<>
              {col(
                <Field label="Fire Exits">
                  <TextInput mobile={m} value={values.fire_exits} onChange={set('fire_exits')} placeholder="Number / details" />
                </Field>,
                true)}
              {col(
                <Field label="Fire NOC Available">
                  <ToggleSwitch checked={values.fireNocAvailable} onChange={set('fireNocAvailable')} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Fire Safety Measures">
                  <TextInput mobile={m} value={values.fireSafetyMeasures} onChange={set('fireSafetyMeasures')} placeholder="Fire safety measures" />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                <Field label="Fire Compliance Cert Type" tooltip="E.g. in Bangalore there is Fire Advisory, or Fire NOC.">
                  <TextInput mobile={m} value={values.fire_compliance_cert_type} onChange={set('fire_compliance_cert_type')} placeholder="Cert type" />
                </Field>,
                true)}
              {col(
                <Field label="Vaastu Compliance">
                  <ToggleSwitch checked={values.vaastuCompliance} onChange={set('vaastuCompliance')} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="WOG Verified">
                  <ToggleSwitch checked={values.wogVerified} onChange={set('wogVerified')} />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Commercials ─────────────────────────────────────── */}
          <Section title="Commercials">
            {row(<>
              {col(
                <Field label="Rate per sq ft" required error={errors.ratePerSqft}>
                  <TextInput mobile={m} value={values.ratePerSqft} onChange={set('ratePerSqft')} placeholder="Rate per sq ft" data-field="ratePerSqft" />
                </Field>,
                true)}
              {col(
                <Field label="Negotiated Rent">
                  <TextInput mobile={m} value={values.negotiated_rent} onChange={set('negotiated_rent')} placeholder="Negotiated rent" />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Availability" tooltip="Please mention the date of availability.">
                  <TextInput mobile={m} value={values.availability} onChange={set('availability')} placeholder="Available, Occupied, etc." />
                </Field>,
                true)
            )}
          </Section>

          {/* ── Metadata ────────────────────────────────────────── */}
          <Section title="Metadata">
            {row(
              col(
                <Field label="Visibility">
                  <ToggleSwitch checked={values.visibility} onChange={set('visibility')} yesLabel="Visible" noLabel="Hidden" />
                </Field>,
                true)
            )}

            <Field label="Upload Files">
              <FileUpload value={values.media} onChange={set('media')} />
            </Field>
          </Section>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div
            className={m ? 'warehouse-form-actions' : ''}
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: m ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: 12,
              position: m ? 'sticky' : 'static',
              bottom: m ? 0 : 'auto',
              background: m ? 'var(--bg-secondary)' : 'transparent',
              padding: m ? '16px 0' : 0,
              borderTop: m ? '1px solid var(--border-primary)' : 'none',
            }}
          >
            <Button
              size="large"
              onClick={handleCancel}
              style={{ minWidth: 120, minHeight: m ? 44 : 'auto', order: m ? 2 : 1, flex: m ? '1' : 'none' }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={submitting ? null : <SaveOutlined />}
              loading={submitting}
              disabled={loading}
              style={{ minWidth: 120, minHeight: m ? 44 : 'auto', order: m ? 1 : 2, flex: m ? '1' : 'none' }}
            >
              {submitting ? (m ? 'Saving...' : 'Saving') : `${initialData ? 'Update' : 'Create'} Warehouse`}
            </Button>
          </div>
        </form>
      </Spin>
    </ResponsiveModal>
  );
};

export default WarehouseForm;
