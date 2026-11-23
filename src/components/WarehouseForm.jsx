import { pptFormErrors } from '../utils/pptFormValidation';
import { HANDOVER_FIELDS, pptFieldRequired, pptFormSnapshot, sameFormAnswer } from '../utils/pptFormPolicy';
import { TextInput, TextAreaInput, SelectInput, MultiSelectInput, ComboBox, DateInput, ToggleSwitch, OfferedAreaInput, HandoverInput } from './WarehouseFormControls';
import { inputBase } from '../utils/warehouseFormStyles';
import { ZONES, POLLUTION_ZONES, BROKER_OPTIONS, STATUS_OPTIONS, OWNER_TYPES, OWNER_WARMTH_OPTIONS, INDIA_STATE_CITIES, INDIA_STATES, LISTING_TYPES, YES_NO } from '../utils/warehouseFormOptions';
import AuthContext from '../contexts/AuthContext';
import { MeasurementField, PhoneField, WashroomField, VentilationField } from './StructuredFields';
import { MEASUREMENTS, LAND_TYPES, CANOPY_TYPES, DOCK_PLATFORM_TYPES, FLOORING_TYPES, hydrateMeasurements, serializeMeasurements, measurementError, washroomError } from '../utils/formFields';
import { phoneState, phoneError, serializePhone } from '../utils/phone';
import { WAREHOUSE_TYPES } from '../utils/warehouseOptions';
import VoiceNotesList from './VoiceNotesList';
import { useState, useContext, useEffect, useCallback, useRef, useId, Children, isValidElement, cloneElement } from 'react';
import { Button, Switch, Spin, Tooltip, message, Select, ConfigProvider } from 'antd';
import { availabilityPayload, reviewDateValue, suggestedReviewDate, todayInIndia } from '../utils/availabilityReview';
import { AVAILABILITY_FIELDS } from '../utils/warehousePermissions';
import { SaveOutlined, QuestionCircleOutlined, ExportOutlined } from '@ant-design/icons';
import FileUpload from './FileUpload';
import ResponsiveModal from './ResponsiveModal';
import VisitNotes from './VisitNotes';
import WarehouseProximityFields from './WarehouseProximityFields';
import './ResponsiveModal.css';
import './WarehouseForm.css';
import { clearErrors } from '../utils/errorHandler';
import { useViewport } from '../hooks/useViewport';
import { getMediaFromWarehouse } from '../utils/mediaUtils';
import { buildCoordMapsLink, COORD_MAPS_LINK_TOOLTIP } from '../utils/mapsLink';
import { deriveZone } from '../utils/deriveZone';
import {
  handoverTypeToEnum, handoverTypeToLabel, handoverUnitToEnum, handoverUnitToLabel,
} from '../utils/handover';
import { WATER_SUPPLY_OPTIONS, waterSupplyToEnum, waterSupplyToLabel } from '../utils/waterSupply';
import { SUITABLE_FOR_OPTIONS } from '../utils/suitableFor';

// ── Tiny helpers ──────────────────────────────────────────────────────────────


const INITIAL_VALUES = {
  warehouseOwnerType: '', warehouseType: '', zone: '', address: '',
  city: '', state: '', postalCode: '', googleLocation: '',
  contactPerson: '', contactNumber: '',
  totalSpaceSqft: [1000], ratePerSqft: '', numberOfDocks: '',
  clearHeightFt: '', availability: '', availabilityLastReviewedOn: '', isBroker: '', uploadedBy: '',
  visibility: true, compliances: '', otherSpecifications: '',
  latitude: '', longitude: '', fireNocAvailable: null,
  fireSafetyMeasures: '', landType: '', approachRoadWidth: '',
  powerKva: '', pollutionZone: '', vaastuCompliance: '',
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
  waterSupply: '',
  // Array, not a string: it is sent to the API exactly as held here.
  suitableFor: [],
  // RCC-only fields (rendered only when warehouseType is 'RCC')
  totalFloors: '', liftAccess: false, passengerLiftCount: '',
  serviceLiftCount: '', liftLoadCapacity: '',
  status: '', lockInDate: '',
  // The mode selects the displayed timing; both values are retained when switching.
  // New rows default to Fixed, matching the pre-toggle behaviour.
  handoverType: 'Fixed', handoverDate: '', handoverLeadValue: '', handoverLeadUnit: '',
  cam: '', chargeableArea: '',
  scoutNotes: '',
  scoutVoiceNotes: [],
  // Derived server-side from the coordinates; displayed read-only and never submitted.
  micromarket: [],
};

const hydrateValues = raw => ({
  ...hydrateMeasurements(raw),
  contactNumber: phoneState(raw.contactNumber),
  alt_phone_number: phoneState(raw.alt_phone_number),
});

/** Flatten initialData (including nested WarehouseData) into form shape */
const toFormValues = (d) => {
  if (!d) return { ...INITIAL_VALUES };
  const wd = d.WarehouseData || d.warehouseData || d;
  return {
    warehouseOwnerType: d.warehouseOwnerType || '',
    warehouseType: d.warehouseType || '',
    // Autofill zone from state at edit time when the record has none. An existing
    // zone is preserved (the user can still change it via the dropdown).
    zone: d.zone || (d.state ? deriveZone(d.state) : ''),
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
    numberOfDocks: d.numberOfDocks ?? '',
    clearHeightFt: d.clearHeightFt ?? '',
    availability: d.availability || '',
    availabilityLastReviewedOn: reviewDateValue(d.availabilityLastReviewedOn),
    isBroker: d.isBroker || '',
    uploadedBy: d.uploadedBy || '',
    visibility: d.visibility === true || d.visibility === 'true' || d.visibility === 1,
    compliances: d.compliances || '',
    otherSpecifications: d.otherSpecifications || '',
    latitude: wd.latitude ?? '',
    longitude: wd.longitude ?? '',
    fireNocAvailable: wd.fireNocAvailable == null ? null : wd.fireNocAvailable === true || wd.fireNocAvailable === 'true',
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
    waterSupply: waterSupplyToLabel(d.waterSupply),
    // Guarded: an older record predates the column and has no value at all.
    suitableFor: Array.isArray(d.suitableFor) ? d.suitableFor : [],
    wogVerified: d.wogVerified === true || d.wogVerified === 'true',
    centreHeight: d.centreHeight || '',
    // RCC-only fields
    totalFloors: d.totalFloors || '',
    liftAccess: d.liftAccess === true || d.liftAccess === 'true',
    passengerLiftCount: d.passengerLiftCount || '',
    serviceLiftCount: d.serviceLiftCount || '',
    liftLoadCapacity: d.liftLoadCapacity || '',
    status: d.status || '',
    // A row saved before the fixed/variable toggle existed has handoverType null and
    // reads back as 'Fixed', preserving whatever date it already carried.
    handoverType: handoverTypeToLabel(d.handoverType),
    handoverDate: d.handoverDate ? String(d.handoverDate).slice(0, 10) : '',
    handoverLeadValue: d.handoverLeadValue ?? '',
    handoverLeadUnit: handoverUnitToLabel(d.handoverLeadUnit),
    lockInDate: d.lockInDate ? String(d.lockInDate).slice(0, 10) : '',
    cam: d.cam || '',
    chargeableArea: d.chargeableArea ?? '',
    scoutNotes: d.scoutNotes || '',
    scoutVoiceNotes: d.scoutVoiceNotes || [],
    micromarket: Array.isArray(d.micromarket) ? d.micromarket : (d.micromarket ? [d.micromarket] : []),
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

const errorStyle = { color: 'var(--text-danger, #ff4d4f)', fontSize: 13, marginTop: 4 };
const sectionTitle = { color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '24px 0 16px' };

// Scroll to a form field, walking up to the nearest scrollable ancestor and
// computing the offset manually. This is more reliable than scrollIntoView for
// nested scroll containers (e.g. fields inside a modal body with overflow: auto).
// Accepts a single field name or an array — when given an array, picks the
// field whose DOM element appears topmost in the document.
const scrollFieldIntoView = (fieldNameOrList) => {
  const names = Array.isArray(fieldNameOrList) ? fieldNameOrList : [fieldNameOrList];
  let el = null;
  let topY = Infinity;
  for (const name of names) {
    if (!name) continue;
    const candidate = document.querySelector(`[data-field="${name}"]`);
    if (!candidate) continue;
    const y = candidate.getBoundingClientRect().top;
    if (y < topY) { topY = y; el = candidate; }
  }
  if (!el) return;
  let container = el.parentElement;
  while (container && container !== document.body) {
    const style = window.getComputedStyle(container);
    if (/(auto|scroll)/.test(style.overflowY) && container.scrollHeight > container.clientHeight) break;
    container = container.parentElement;
  }
  if (container && container !== document.body) {
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - containerRect.top + container.scrollTop - (container.clientHeight / 2) + (elRect.height / 2);
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (typeof el.focus === 'function') el.focus({ preventScroll: true });
};

// ── Reusable field components ─────────────────────────────────────────────────

const Field = ({ label, required, error, hint, children, style, mobile, tooltip }) => {
  const id = useId();
  let controlIndex = 0;
  const connect = nodes => Children.map(nodes, child => {
    if (!isValidElement(child)) return child;
    const isControl = ['input', 'textarea', 'select', TextInput, TextAreaInput, SelectInput, MultiSelectInput, ComboBox, DateInput, ToggleSwitch, OfferedAreaInput, Select, Switch].includes(child.type);
    if (isControl) {
      const index = controlIndex++;
      const name = label === 'Handover' ? `Handover ${child.props.placeholder === 'Mode' ? 'mode' : child.props.placeholder === 'Unit' ? 'unit' : child.type === DateInput ? 'date' : 'lead time'}` : undefined;
      return cloneElement(child, {
        id: `${id}-${index}`,
        'aria-labelledby': name ? undefined : `${id}-label`,
        'aria-label': child.props['aria-label'] || name,
        'aria-required': required || undefined,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined,
      });
    }
    return child.props.children ? cloneElement(child, {}, connect(child.props.children)) : child;
  });
  const connected = connect(children);
  return <div style={{ marginBottom: 20, ...style }}>
    {label && <label id={`${id}-label`} htmlFor={controlIndex ? `${id}-0` : undefined} style={labelStyle(mobile)}>
      {label}{required && <span aria-hidden="true" style={{ color: 'var(--text-danger, #ff4d4f)' }}> *</span>}
      {tooltip && <Tooltip title={tooltip} placement="top"><QuestionCircleOutlined style={{ marginLeft: 6, color: 'var(--text-secondary, #888)', cursor: 'help', fontSize: 13 }} /></Tooltip>}
    </label>}
    {connected}
    {hint && <div id={`${id}-hint`} style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>{hint}</div>}
    {error && <div id={`${id}-error`} role="alert" style={errorStyle}>{error}</div>}
  </div>;
};


const Section = ({ title, children }) => (
  <div>
    <div style={sectionTitle}>{title}</div>
    {children}
  </div>
);

// Native controls inherit fieldset's disabled state; AntD composite controls
// use its disabled context. Both remain readable and accessible to assistive tech.
const ProtectedFields = ({ disabled, label, children }) => (
  <fieldset className="warehouse-form-protected-fields" disabled={disabled} aria-label={label}>
    <ConfigProvider componentDisabled={disabled || undefined}>{children}</ConfigProvider>
  </fieldset>
);

// ── Main component ────────────────────────────────────────────────────────────

const WarehouseForm = ({ visible, onCancel, onSubmit, initialData = null, loading = false, reviewActions = null, availabilityOnly = false }) => {
  const { isMobile } = useViewport();
  const { user } = useContext(AuthContext) || {};
  const [values, setValues] = useState(() => hydrateValues(INITIAL_VALUES));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [contactTouched, setContactTouched] = useState(false);
  const availabilitySnapshot = useRef(null);
  const [formBaseline, setFormBaseline] = useState(null);
  const reviewDateTouched = useRef(false);
  // Once the user manually picks a zone, stop autofilling it from the state.
  const [zoneTouched, setZoneTouched] = useState(false);
  useEffect(() => {
    if (visible) {
      setValues(hydrateValues({ ...toFormValues(initialData),
        uploadedBy: initialData ? initialData.uploadedBy || '' : user?.email || '',
      }));
      setErrors({});
      setInitialSnapshot(initialData);
      availabilitySnapshot.current = initialData;
      setFormBaseline(initialData ? { ...pptFormSnapshot(initialData),
        status: initialData.status ?? null, lockInDate: reviewDateValue(initialData.lockInDate) || null,
      } : null);
      reviewDateTouched.current = false;
      setContactTouched(false);
      setZoneTouched(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Patch in background-fetched contact number without resetting the form
  useEffect(() => {
    if (visible && !contactTouched && initialData && initialSnapshot &&
      initialData.id === initialSnapshot.id &&
      initialData.contactNumber !== initialSnapshot.contactNumber) {
      setValues(prev => ({ ...prev, contactNumber: initialData.contactNumber ? phoneState(initialData.contactNumber) : prev.contactNumber }));
      setInitialSnapshot(initialData);
    }
  }, [visible, initialData, initialSnapshot, contactTouched]);

  const isEditing = Boolean(initialData);
  const needsLocation = !isEditing || values.googleLocation.trim() !== (formBaseline?.googleLocation || '').trim();
  const needsLandType = !isEditing || values.landType !== (formBaseline?.landType ?? '');

  const set = (field) => (val) => {
    if (availabilityOnly && !AVAILABILITY_FIELDS.includes(field)) return;
    if (field === 'availabilityLastReviewedOn') reviewDateTouched.current = true;
    setValues(prev => ({
      ...prev, [field]: val,
      ...(field === 'availability' && !reviewDateTouched.current ? {
        availabilityLastReviewedOn: suggestedReviewDate(availabilitySnapshot.current, val),
      } : {}),
    }));
    if (field === 'contactNumber') setContactTouched(true);
    if (field === 'zone') setZoneTouched(true);
    // Clear error on change
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const setStateField = (val) => {
    if (availabilityOnly) return;
    const autoCity = val === 'Delhi' ? 'New Delhi' : val === 'Chandigarh' ? 'Chandigarh' : '';
    setValues(prev => ({
      ...prev,
      state: val,
      city: autoCity,
      zone: !zoneTouched && val ? deriveZone(val) : prev.zone,
    }));
    setErrors(prev => ({ ...prev, state: null, city: null }));
  };

  const pptRequired = key => pptFieldRequired(formBaseline || initialData, key);

  const buildAvailabilityPayload = () => {
    const data = {
      ...(formBaseline && { expectedFormValues: formBaseline }),
      ...availabilityPayload(values, availabilitySnapshot.current),
      status: values.status || null,
      lockInDate: values.lockInDate || null,
      handoverType: handoverTypeToEnum(values.handoverType),
      handoverDate: values.handoverDate || null,
      handoverLeadValue: values.handoverLeadValue === '' || values.handoverLeadValue == null
        ? null : Number(values.handoverLeadValue),
      handoverLeadUnit: handoverUnitToEnum(values.handoverLeadUnit),
    };
    if (availabilityOnly && formBaseline) {
      // Preserve untouched legacy answers and inactive timing without resending
      // them. The server checks intentional edits against the original snapshot.
      for (const key of ['status', 'lockInDate', ...HANDOVER_FIELDS]) {
        if (sameFormAnswer(key === 'lockInDate' ? 'handoverDate' : key, data[key], formBaseline[key])) delete data[key];
      }
    }
    return data;
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (silent = false) => {
    const e = {};
    const availabilityData = buildAvailabilityPayload();
    if (!availabilityOnly) {
      if (!values.listing_type) e.listing_type = 'Listing type is required';
      if (!values.warehouseType?.trim()) e.warehouseType = 'Warehouse type is required';
      if (!values.address?.trim()) e.address = 'Address is required';
      if (!values.city?.trim()) e.city = 'City is required';
      if (!values.state?.trim()) e.state = 'State is required';
      if (!values.contactPerson?.trim()) e.contactPerson = 'Contact person is required';
      const contactError = phoneError(values.contactNumber, { required: true, allowLegacy: isEditing });
      if (contactError) e.contactNumber = contactError;
      const alternateError = phoneError(values.alt_phone_number, { allowLegacy: isEditing });
      if (alternateError) e.alt_phone_number = alternateError;
      for (const key of Object.keys(MEASUREMENTS)) {
        const error = measurementError(values[key], key);
        if (error) e[key] = error;
      }
      const countError = washroomError(values.washroom_count);
      if (countError) e.washroom_count = countError;
      if (needsLandType && !values.landType.trim()) e.landType = 'Land Type is required';
      if (needsLocation && !values.googleLocation.trim()) e.googleLocation = 'Google Location URL is required';
      const spaces = (values.totalSpaceSqft || []).filter(v => v != null && v > 0);
      if (spaces.length === 0) e.totalSpaceSqft = 'At least one space value is required';
      if (!values.ratePerSqft && values.ratePerSqft !== 0) e.ratePerSqft = 'Rate per sq ft is required';
      if (!isEditing && !values.uploadedBy?.trim()) e.uploadedBy = 'Sign in before creating a warehouse';
      if (!values.compliances) e.compliances = 'Compliance info is required';

      if (values.chargeableArea !== '' && values.chargeableArea != null) {
        const n = Number(values.chargeableArea);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          e.chargeableArea = 'Chargeable area must be a non-negative whole number';
        }
      }
    }

    // Validate entered inactive values too; the PPT policy below requires the active timing.
    if ((!availabilityOnly || Object.hasOwn(availabilityData, 'handoverLeadValue'))
      && values.handoverLeadValue !== '' && values.handoverLeadValue != null) {
      const n = Number(values.handoverLeadValue);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > 120) {
        e.handoverLeadValue = 'Lead time must be a whole number between 1 and 120';
      }
    }

    if ((!availabilityOnly || Object.hasOwn(availabilityData, 'availabilityLastReviewedOn')) && values.availabilityLastReviewedOn) {
      if (!values.availability?.trim()) e.availabilityLastReviewedOn = 'Select availability before recording a review date';
      else if (values.availabilityLastReviewedOn > todayInIndia()) e.availabilityLastReviewedOn = 'Review date cannot be in the future';
    }

    // Latitude and longitude validation removed to support high precision formats

    for (const [key, error] of Object.entries(pptFormErrors(availabilityOnly ? availabilityData : values, formBaseline || initialData))) {
      e[key] ||= error;
    }

    if (!silent) setErrors(e);

    const missingKeys = Object.keys(e);
    if (missingKeys.length > 0 && !silent) {
      message.error(
        missingKeys.length === 1
          ? e[missingKeys[0]]
          : `Please check ${missingKeys.length} highlighted fields`
      );
      setTimeout(() => scrollFieldIntoView(missingKeys), 50);
    }

    return missingKeys.length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  // Build the warehouse payload from the current form values. Extracted from
  // handleSubmit so the review actions (Accept/Reject) can persist any in-form
  // edits before approving/rejecting — otherwise unsaved edits never reach the
  // promoted warehouse or the submitter's WhatsApp notification.
  const buildPayload = () => {
    const availabilityData = buildAvailabilityPayload();
    // Do not serialize unrelated controls: older entries can contain missing or
    // legacy values that this employee has no permission to correct.
    if (availabilityOnly) return availabilityData;
    const submissionValues = {
      ...serializeMeasurements(values),
      contactNumber: serializePhone(values.contactNumber, isEditing),
      alt_phone_number: serializePhone(values.alt_phone_number, isEditing),
    };
    // Build media from form state (the FileUpload now manages a media object)
    const media = submissionValues.media || { images: [], videos: [], docs: [] };
    const hasMedia = (media.images?.length || 0) + (media.videos?.length || 0) + (media.docs?.length || 0) > 0;

    // Double-write: flatten media back to photos CSV for legacy column
    const allUrls = [...(media.images || []), ...(media.videos || []), ...(media.docs || [])];
    const photosValue = allUrls.length > 0 ? allUrls.join(',') : null;

    return {
        ...availabilityData,
        warehouseOwnerType: submissionValues.warehouseOwnerType || null,
        warehouseType: submissionValues.warehouseType,
        address: submissionValues.address,
        googleLocation: submissionValues.googleLocation || null,
        city: submissionValues.city,
        state: submissionValues.state,
        postalCode: submissionValues.postalCode || null,
        zone: submissionValues.zone,
        contactPerson: submissionValues.contactPerson,
        contactNumber: submissionValues.contactNumber,
        totalSpaceSqft: (submissionValues.totalSpaceSqft || []).filter(v => v != null && v > 0),
        numberOfDocks: submissionValues.numberOfDocks === '' || submissionValues.numberOfDocks == null ? null : String(submissionValues.numberOfDocks),
        clearHeightFt: submissionValues.clearHeightFt ? String(submissionValues.clearHeightFt) : null,
        compliances: submissionValues.compliances,
        otherSpecifications: submissionValues.otherSpecifications || null,
        ratePerSqft: submissionValues.ratePerSqft === '' || submissionValues.ratePerSqft == null ? null : String(submissionValues.ratePerSqft),
        ...(submissionValues.uploadedBy ? { uploadedBy: submissionValues.uploadedBy } : {}),
        visibility: Boolean(submissionValues.visibility),
        isBroker: submissionValues.isBroker || null,
        photos: photosValue,
        media: hasMedia ? media : null,
        // Newly added fields (all optional)
        listing_type: submissionValues.listing_type || null,
        alt_phone_number: submissionValues.alt_phone_number || null,
        land_parcel_size: submissionValues.land_parcel_size || null,
        builtup_area: submissionValues.builtup_area || null,
        owner_warmnth: submissionValues.owner_warmnth || null,
        distance_from_highway: submissionValues.distance_from_highway || null,
        is_builder: typeof submissionValues.is_builder === 'boolean' ? submissionValues.is_builder : null,
        owner_of_multiple_sites: submissionValues.owner_of_multiple_sites || null,
        carpet_area: submissionValues.carpet_area || null,
        nearest_transport: submissionValues.nearest_transport || null,
        fire_exits: submissionValues.fire_exits || null,
        fire_compliance_cert_type: submissionValues.fire_compliance_cert_type || null,
        negotiated_rent: submissionValues.negotiated_rent || null,
        washroom_count: submissionValues.washroom_count || null,
        ownerCompanyName: submissionValues.ownerCompanyName || null,
        ownerAltPoc: submissionValues.ownerAltPoc || null,
        gateSizeFt: submissionValues.gateSizeFt || null,
        dockApronLengthFt: submissionValues.dockApronLengthFt || null,
        setbackArea: submissionValues.setbackArea || null,
        ccRoads: typeof submissionValues.ccRoads === 'boolean'
          ? (submissionValues.ccRoads ? 'true' : 'false')
          : (submissionValues.ccRoads || null),
        wallAndSecurityRoom: submissionValues.wallAndSecurityRoom || null,
        plinthHeightFt: submissionValues.plinthHeightFt || null,
        dockDimension: submissionValues.dockDimension || null,
        canopyType: submissionValues.canopyType || null,
        dockPlatformType: submissionValues.dockPlatformType || null,
        otherDockingSpecs: submissionValues.otherDockingSpecs || null,
        flooringType: submissionValues.flooringType || null,
        floorStrengthPerSqm: submissionValues.floorStrengthPerSqm || null,
        ventilationType: submissionValues.ventilationType || null,
        ventilationAirChangesPerDay: submissionValues.ventilationAirChangesPerDay || null,
        insulationPresent: typeof submissionValues.insulationPresent === 'boolean'
          ? (submissionValues.insulationPresent ? 'true' : 'false')
          : (submissionValues.insulationPresent || null),
        insulationType: submissionValues.insulationType || null,
        lightingDetails: submissionValues.lightingDetails || null,
        waterSupply: waterSupplyToEnum(submissionValues.waterSupply),
        // Sent as an array, never null: the column defaults to [] and the API
        // treats an empty array as "no tags" rather than as unset.
        suitableFor: Array.isArray(submissionValues.suitableFor) ? submissionValues.suitableFor : [],
        wogVerified: typeof submissionValues.wogVerified === 'boolean' ? submissionValues.wogVerified : null,
        centreHeight: submissionValues.centreHeight || null,
        // RCC-only fields. Sent regardless of the current warehouseType so that
        // switching type away from RCC hides the inputs without wiping the data.
        totalFloors: submissionValues.totalFloors || null,
        liftAccess: typeof submissionValues.liftAccess === 'boolean' ? submissionValues.liftAccess : null,
        passengerLiftCount: submissionValues.passengerLiftCount || null,
        serviceLiftCount: submissionValues.serviceLiftCount || null,
        liftLoadCapacity: submissionValues.liftLoadCapacity || null,
        cam: submissionValues.cam || null,
        chargeableArea: submissionValues.chargeableArea === '' || submissionValues.chargeableArea == null
          ? null
          : Number(submissionValues.chargeableArea),
        scoutNotes: submissionValues.scoutNotes?.trim() || null,
        scoutVoiceNotes: (submissionValues.scoutVoiceNotes || []).map(note => ({ id: note.id })),
        warehouseData: {
          latitude: submissionValues.latitude === '' ? null : submissionValues.latitude,
          longitude: submissionValues.longitude === '' ? null : submissionValues.longitude,
          fireNocAvailable: typeof submissionValues.fireNocAvailable === 'boolean' ? submissionValues.fireNocAvailable : null,
          fireSafetyMeasures: submissionValues.fireSafetyMeasures || null,
          landType: submissionValues.landType || null,
          approachRoadWidth: submissionValues.approachRoadWidth ? String(submissionValues.approachRoadWidth) : null,
          dimensions: submissionValues.dimensions || null,
          parkingDockingSpace: submissionValues.parkingDockingSpace || null,
          pollutionZone: submissionValues.pollutionZone || null,
          powerKva: submissionValues.powerKva ? String(submissionValues.powerKva) : null,
          vaastuCompliance: typeof submissionValues.vaastuCompliance === 'boolean'
            ? (submissionValues.vaastuCompliance ? 'true' : 'false')
            : (submissionValues.vaastuCompliance || null),
        },
      };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit(buildPayload());
      setValues(hydrateValues(INITIAL_VALUES));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = useCallback(() => {
    setValues(hydrateValues(INITIAL_VALUES));
    setErrors({});
    clearErrors();
    onCancel();
  }, [onCancel]);

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const m = isMobile;
  // Rebuilt on every render so it tracks the latitude/longitude fields as they are edited.
  const coordMapsLink = buildCoordMapsLink(values.latitude, values.longitude);
  const row = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 0 : 16 }}>
      {children}
    </div>
  );
  const col = (children, half = false) => (
    <div style={{ minWidth: 0, width: (half && !m) ? 'calc(50% - 8px)' : '100%' }}>
      {children}
    </div>
  );

  if (!visible) return null;

  return (
    <ResponsiveModal
      visible={visible}
      onClose={handleCancel}
      title={availabilityOnly ? `Edit Availability — #${initialData?.id}` : initialData ? 'Edit Warehouse' : 'Create New Warehouse'}
      maxWidth="900px"
      className="warehouse-form-modal"
      bodyStyle={m ? { padding: 0, overflow: 'hidden' } : availabilityOnly ? { paddingBottom: 0 } : undefined}
    >
      <Spin
        spinning={loading || submitting}
        tip={<div style={{ color: 'var(--text-primary)', fontSize: m ? 16 : 14, marginTop: 8 }}>
          {submitting ? 'Saving warehouse...' : 'Loading...'}
        </div>}
        size={m ? 'large' : 'default'}
      >
        <form noValidate onSubmit={handleSubmit} style={{ color: 'var(--text-primary)' }}>

          <div className="warehouse-form-fields">

          {availabilityOnly && <p>You can edit the Availability section. Other fields are shown below as read-only.</p>}

          {/* ── Owner Details ───────────────────────────────────── */}
          <ProtectedFields disabled={availabilityOnly} label="Owner details">
          <Section title="Owner Details">
            {row(<>
              {col(
                <Field label="Listing Type" required error={errors.listing_type}>
                  <SelectInput mobile={m} value={values.listing_type} onChange={set('listing_type')} placeholder="Select listing type" options={LISTING_TYPES} data-field="listing_type" />
                </Field>,
                true)}
              {col(
                <Field label="Warehouse Owner Type">
                  <SelectInput mobile={m} value={values.warehouseOwnerType} onChange={set('warehouseOwnerType')} placeholder="Select owner type" options={OWNER_TYPES} data-field="warehouseOwnerType" />
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
                availabilityOnly ? <Field label="Contact Number">
                  <TextInput mobile={m} value={initialData?.contactNumber || 'Not revealed'} readOnly />
                </Field> : <PhoneField field="contactNumber" label="Contact Number" value={values.contactNumber} onChange={set('contactNumber')} error={errors.contactNumber} required />,
                true)}
            </>)}

            {row(<>
              {col(
                <PhoneField field="alt_phone_number" label="Alternate Phone Number" value={values.alt_phone_number} onChange={set('alt_phone_number')} error={errors.alt_phone_number} />,
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
                  <ToggleSwitch checked={values.isBroker === true || values.isBroker === 'true' || values.isBroker === 'Yes'} onChange={(v) => set('isBroker')(v ? 'Yes' : 'No')} />
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
                <Field label="Owner Warmth" tooltip="Rate the owner's personality. Green = positive and collaborative; Yellow = neutral; Red = hard to deal with.">
                  <SelectInput mobile={m} value={values.owner_warmnth} onChange={set('owner_warmnth')} placeholder="Select owner warmth" options={OWNER_WARMTH_OPTIONS} />
                </Field>,
                true)}
              {col(
                <Field label="Owner of Multiple Sites">
                  <SelectInput mobile={m} value={values.owner_of_multiple_sites} onChange={set('owner_of_multiple_sites')} placeholder="Select Yes / No" options={YES_NO} />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Uploaded By" error={errors.uploadedBy} hint="Recorded from the account that submitted this warehouse.">
                  <TextInput mobile={m} value={values.uploadedBy} onChange={() => {}} readOnly placeholder="Original uploader not recorded" data-field="uploadedBy" />
                </Field>,
                true)
            )}
          </Section>
          </ProtectedFields>

          {/* ── Availability ────────────────────────────────────── */}
          <Section title="Availability">
            {row(<>
              {col(
                <Field label="Availability" tooltip="If the space can be booked (now/in future) within the next 6 months, then Y, else N.">
                  <SelectInput mobile={m} value={values.availability} onChange={set('availability')} placeholder="Select availability" options={YES_NO} />
                </Field>,
                true)}
              {col(
                <Field label="Availability last reviewed" error={errors.availabilityLastReviewedOn}
                  hint="Select the date availability was last checked. Past dates are allowed.">
                  <DateInput mobile={m} value={values.availabilityLastReviewedOn}
                    onChange={set('availabilityLastReviewedOn')} data-field="availabilityLastReviewedOn"
                    disabledDate={date => date.format('YYYY-MM-DD') > todayInIndia()} />
                  {values.availabilityLastReviewedOn && reviewDateValue(availabilitySnapshot.current?.availabilityLastReviewedOn)
                    && values.availabilityLastReviewedOn < reviewDateValue(availabilitySnapshot.current.availabilityLastReviewedOn) && (
                    <div role="status" style={{ color: 'var(--text-warning, #d89614)', fontSize: 12, marginTop: 6 }}>
                      This replaces a more recent review date. Check that you are correcting the recorded date.
                    </div>
                  )}
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <Field
                  label="Handover" required={pptRequired('handoverDate')}
                  error={errors.handoverType || errors.handoverDate || errors.handoverLeadValue || errors.handoverLeadUnit}
                  tooltip="Pick Fixed for a confirmed handover date, or Variable for a lead time after the letter of intent (LOI), including its unit."
                  hint='PPTs and Last Mile Excel show "Unconfirmed" unless a handover date or complete lead time is recorded. Availability alone does not confirm handover.'
                >
                  <HandoverInput mobile={m} errors={errors} required={pptRequired('handoverDate')} value={values} onChange={(key, value) => set(key)(value)} />
                </Field>,
                true)}
              {col(
                <Field label="Lock-in Date" tooltip="Fill if Availability = N; by when will the lock-in / agreement duration end, when it could potentially become available.">
                  <DateInput mobile={m} value={values.lockInDate} onChange={set('lockInDate')} />
                </Field>,
                true)}
            </>)}
            {row(col(
              <Field label="Status" tooltip="Mention the building construction status (not related to whether it is occupied or not).">
                <SelectInput mobile={m} value={values.status} onChange={set('status')} placeholder="Select status" options={STATUS_OPTIONS} />
              </Field>,
              true))}
          </Section>

          {/* ── Location Details ────────────────────────────────── */}
          <ProtectedFields disabled={availabilityOnly} label="Other warehouse details">
          <Section title="Location Details">
            <Field label="Address" required error={errors.address} tooltip="Please mention the locality, but not the exact address.">
              <TextAreaInput mobile={m} value={values.address} onChange={set('address')} placeholder="Enter locality" rows={m ? 3 : 2} data-field="address" />
            </Field>

            {row(<>
              {col(
                <Field label="State" required error={errors.state}>
                  <ComboBox mobile={m} value={values.state} onChange={setStateField} options={INDIA_STATES} placeholder="Select state" data-field="state" />
                </Field>,
                true)}
              {col(
                <Field label="City" required error={errors.city}>
                  <ComboBox mobile={m} value={values.city} onChange={set('city')} options={INDIA_STATE_CITIES[values.state] || []} placeholder="Select city" disabled={!values.state} data-field="city" />
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
                <Field label="Zone" error={errors.zone} tooltip="Auto-filled from the State — pick a value here to override it.">
                  <SelectInput mobile={m} value={values.zone} onChange={set('zone')} placeholder="Auto-filled from State" options={ZONES} data-field="zone" />
                </Field>,
                true)}
            </>)}

            {/* Read-only: the server derives the tags from the coordinates on save
                (warehouseService.applyMicroMarketTags), so there is nothing to edit here. */}
            <Field label="Micro Market" tooltip="Derived automatically from the latitude/longitude — not editable.">
              <TextInput
                mobile={m}
                value={(values.micromarket || []).filter(Boolean).join(', ')}
                onChange={() => {}}
                readOnly
                placeholder="Auto-tagged from coordinates"
                style={{ ...inputBase(m), background: 'var(--bg-secondary, #1f1f1f)', color: 'var(--text-secondary, #aaa)', cursor: 'default' }}
              />
            </Field>

            <Field label="Google Location URL" required={needsLocation} error={errors.googleLocation}>
              <TextInput mobile={m} value={values.googleLocation} onChange={set('googleLocation')} placeholder="Google Maps URL" type="url" data-field="googleLocation" />
            </Field>

            {/* Read-only fallback, rebuilt live from the coordinate fields below. */}
            <Field label="Alternative Maps Link" tooltip={COORD_MAPS_LINK_TOOLTIP}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TextInput
                  mobile={m}
                  value={coordMapsLink || ''}
                  onChange={() => {}}
                  readOnly
                  placeholder="Enter latitude and longitude to generate"
                  style={{ ...inputBase(m), background: 'var(--bg-secondary, #1f1f1f)', color: 'var(--text-secondary, #aaa)', cursor: 'default' }}
                />
                {coordMapsLink && (
                  <a
                    href={coordMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--link-color, #4ea1f5)', textDecoration: 'none', whiteSpace: 'nowrap', fontSize: m ? 16 : 14 }}
                  >
                    Open <ExportOutlined aria-hidden="true" />
                  </a>
                )}
              </div>
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
                <MeasurementField field="distance_from_highway" value={values.distance_from_highway} onChange={set('distance_from_highway')} error={errors.distance_from_highway} />,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField field="approachRoadWidth" value={values.approachRoadWidth} onChange={set('approachRoadWidth')} error={errors.approachRoadWidth} />,
                true)}
              {col(
                <Field label="Land Type" required={needsLandType} error={errors.landType}>
                  <SelectInput mobile={m} value={values.landType} onChange={set('landType')} placeholder="Select land type" options={LAND_TYPES} data-field="landType" />
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
            {row(
              col(
                <Field label="Warehouse Type" required error={errors.warehouseType} tooltip="Please mention PEB / RCC / Shed. Use 'Shed' for old-style godowns.">
                  <SelectInput mobile={m} value={values.warehouseType} onChange={set('warehouseType')} placeholder="Select warehouse type" options={WAREHOUSE_TYPES} data-field="warehouseType" />
                </Field>,
                true)
            )}

            {/* RCC-specific specs. Hidden for other warehouse types, but any values
                already captured are kept and still submitted. Mirrored in
                WarehouseDetailsModal. */}
            {values.warehouseType === 'RCC' && (<>
              {row(<>
                {col(
                  <Field label="Total Number of Floors">
                    <TextInput mobile={m} value={values.totalFloors} onChange={set('totalFloors')} placeholder="e.g. G+3" />
                  </Field>,
                  true)}
                {col(
                  <Field label="Lift Access">
                    <ToggleSwitch checked={values.liftAccess} onChange={set('liftAccess')} />
                  </Field>,
                  true)}
              </>)}

              {values.liftAccess && (<>
                {row(<>
                  {col(
                    <Field label="Number of Passenger Lifts">
                      <TextInput mobile={m} value={values.passengerLiftCount} onChange={set('passengerLiftCount')} placeholder="Number of passenger lifts" />
                    </Field>,
                    true)}
                  {col(
                    <Field label="Number of Service Lifts">
                      <TextInput mobile={m} value={values.serviceLiftCount} onChange={set('serviceLiftCount')} placeholder="Number of service lifts" />
                    </Field>,
                    true)}
                </>)}

                {row(
                  col(
                    <Field label="Lift Load Capacity" tooltip="Load capacity per lift, e.g. 2 T or 2000 kg.">
                      <TextInput mobile={m} value={values.liftLoadCapacity} onChange={set('liftLoadCapacity')} placeholder="e.g. 2 T" />
                    </Field>,
                    true)
                )}
              </>)}
            </>)}

            {row(<>
              {col(
                /* NOTE: 'totalSpaceSqft' from the schema is displayed as "Offered Area" here per user request */
                <Field label={values.warehouseType === 'RCC' ? 'Offered Area per Floor (sq ft)' : 'Offered Area (sq ft)'} required error={errors.totalSpaceSqft} tooltip="Please mention all kinds of areas offered, including partition possibilities.">
                  <OfferedAreaInput mobile={m} value={values.totalSpaceSqft}
                    onChange={set('totalSpaceSqft')} label={values.warehouseType === 'RCC' ? 'Offered Area per Floor (sq ft)' : 'Offered Area (sq ft)'} />
                </Field>,
                true)}
              {col(
                <Field label="Chargeable Area (sq ft)" error={errors.chargeableArea} tooltip="The billable area used to compute rent.">
                  <TextInput mobile={m} value={values.chargeableArea} onChange={v => set('chargeableArea')(String(v).replace(/[^0-9]/g, ''))} placeholder="Chargeable area" type="text" inputMode="numeric" pattern="[0-9]*" data-field="chargeableArea" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField field="land_parcel_size" value={values.land_parcel_size} onChange={set('land_parcel_size')} error={errors.land_parcel_size} />,
                true)}
              {col(
                <MeasurementField field="builtup_area" value={values.builtup_area} onChange={set('builtup_area')} error={errors.builtup_area} />,
                true)}
            </>)}

            {row(col(
              <MeasurementField field="carpet_area" value={values.carpet_area} onChange={set('carpet_area')} error={errors.carpet_area} />,
              true
            ))}

            {row(col(<MeasurementField field="dimensions" value={values.dimensions} onChange={set('dimensions')} error={errors.dimensions} />))}

            {row(<>
              {col(
                <MeasurementField required={pptRequired('clearHeightFt')} field="clearHeightFt" value={values.clearHeightFt} onChange={set('clearHeightFt')} error={errors.clearHeightFt} />,
                true)}
              {col(
                <MeasurementField field="centreHeight" value={values.centreHeight} onChange={set('centreHeight')} error={errors.centreHeight} />,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField required={pptRequired('plinthHeightFt')} field="plinthHeightFt" value={values.plinthHeightFt} onChange={set('plinthHeightFt')} error={errors.plinthHeightFt} />,
                true)}
              {col(
                <Field label="Number of Docks" required={pptRequired('numberOfDocks')} error={errors.numberOfDocks}>
                  <TextInput data-field="numberOfDocks" aria-label="Number of Docks" aria-invalid={Boolean(errors.numberOfDocks)} mobile={m} value={values.numberOfDocks} onChange={set('numberOfDocks')} placeholder="Number of docks" />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField field="dockDimension" value={values.dockDimension} onChange={set('dockDimension')} error={errors.dockDimension} />,
                true)}
              {col(
                <Field label="Canopy Type" required={pptRequired('canopyType')} error={errors.canopyType}>
                  <SelectInput data-field="canopyType" aria-label="Canopy Type" aria-invalid={Boolean(errors.canopyType)} mobile={m} value={values.canopyType} onChange={set('canopyType')} options={CANOPY_TYPES} placeholder="Select an option" allowClear />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField field="dockApronLengthFt" value={values.dockApronLengthFt} onChange={set('dockApronLengthFt')} error={errors.dockApronLengthFt} />,
                true)}
              {col(
                <Field label="Dock Platform Type">
                  <SelectInput mobile={m} value={values.dockPlatformType} onChange={set('dockPlatformType')} options={DOCK_PLATFORM_TYPES} placeholder="Select an option" allowClear />
                </Field>,
                true)}
            </>)}

            {row(<>
              {col(
                <MeasurementField field="gateSizeFt" value={values.gateSizeFt} onChange={set('gateSizeFt')} error={errors.gateSizeFt} />,
                true)}
              {col(
                <Field label="Setback Area" tooltip="Setback area around the box.">
                  <TextInput mobile={m} value={values.setbackArea} onChange={set('setbackArea')} placeholder="e.g. 5m on all sides" />
                </Field>,
                true)}
            </>)}

            <Field label="Other Docking Specs" tooltip="Please mention if cross docks, levellers, or other specs are present.">
              <TextAreaInput mobile={m} value={values.otherDockingSpecs} onChange={set('otherDockingSpecs')} placeholder="Other docking specifications" rows={m ? 3 : 2} />
            </Field>

            {row(
              col(
                <Field label="Paved Roads inside Warehouse?">
                  <ToggleSwitch checked={values.ccRoads === true || values.ccRoads === 'true' || values.ccRoads === 'Yes'} onChange={(v) => set('ccRoads')(v)} />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                <Field label="Flooring Type" required={pptRequired('flooringType')} error={errors.flooringType}>
                  <SelectInput data-field="flooringType" aria-label="Flooring Type" aria-invalid={Boolean(errors.flooringType)} mobile={m} value={values.flooringType} onChange={set('flooringType')} options={FLOORING_TYPES} placeholder="Select an option" allowClear />
                </Field>,
                true)}
              {col(
                <MeasurementField required={pptRequired('floorStrengthPerSqm')} field="floorStrengthPerSqm" value={values.floorStrengthPerSqm} onChange={set('floorStrengthPerSqm')} error={errors.floorStrengthPerSqm} />,
                true)}
            </>)}

            {row(<>
              {col(
                <VentilationField required={pptRequired('ventilationType')} error={errors.ventilationType} value={values.ventilationType} onChange={set('ventilationType')} />,
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
                  <ToggleSwitch checked={values.insulationPresent === true || values.insulationPresent === 'true' || values.insulationPresent === 'Yes'} onChange={(v) => set('insulationPresent')(v)} />
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
                <MeasurementField field="lightingDetails" value={values.lightingDetails} onChange={set('lightingDetails')} error={errors.lightingDetails} />,
                true)}
              {col(
                <MeasurementField required={pptRequired('powerKva')} field="powerKva" value={values.powerKva} onChange={set('powerKva')} error={errors.powerKva} />,
                true)}
            </>)}

            {row(
              col(
                <Field label="Water Supply" tooltip="How is water supplied to the site?">
                  <SelectInput mobile={m} value={values.waterSupply} onChange={set('waterSupply')} placeholder="Select water supply" options={WATER_SUPPLY_OPTIONS} />
                </Field>,
                true)
            )}

            <Field
              label="Suitable For"
              tooltip="Which use-cases this site suits. Pick as many as apply."
            >
              <MultiSelectInput
                mobile={m}
                value={values.suitableFor}
                onChange={set('suitableFor')}
                placeholder="Select use-cases"
                options={SUITABLE_FOR_OPTIONS}
              />
            </Field>

            <Field label="Parking Space Availability">
              <TextAreaInput mobile={m} value={values.parkingDockingSpace} onChange={set('parkingDockingSpace')} placeholder="Mention area for seperate parking if available" rows={m ? 3 : 2} />
            </Field>

            {row(<>
              {col(
                <WashroomField required={pptRequired('washroom_count')} value={values.washroom_count} onChange={set('washroom_count')} error={errors.washroom_count} />,
                true)}
              {col(
                <Field label="Security Features">
                  <TextInput mobile={m} value={values.wallAndSecurityRoom} onChange={set('wallAndSecurityRoom')} placeholder="eg: Security Room, CCTV etc" />
                </Field>,
                true)}
            </>)}

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
                  <TextInput mobile={m} value={values.fire_exits} onChange={set('fire_exits')} placeholder="Number of Fire Exits" />
                </Field>,
                true)}
              {col(
                <Field label="Fire NOC Available" required={pptRequired('fireNocAvailable')} error={errors.fireNocAvailable}>
                  <SelectInput mobile={m} data-field="fireNocAvailable" aria-label="Fire NOC Available" aria-invalid={Boolean(errors.fireNocAvailable)} id="scout-fireNocAvailable"
                      value={values.fireNocAvailable == null ? '' : values.fireNocAvailable ? 'Yes' : 'No'}
                      onChange={value => set('fireNocAvailable')(value === '' ? null : value === 'Yes')}
                      options={['Yes', 'No']} placeholder="Select Yes or No" allowClear />
                </Field>,
                true)}
            </>)}

            {row(
              col(
                <Field label="Fire Safety Measures" required={pptRequired('fireSafetyMeasures')} error={errors.fireSafetyMeasures}>
                  <TextInput data-field="fireSafetyMeasures" aria-label="Fire Safety Measures" aria-invalid={Boolean(errors.fireSafetyMeasures)} mobile={m} value={values.fireSafetyMeasures} onChange={set('fireSafetyMeasures')} placeholder="eg: Hydrants, Sprinklers etc" />
                </Field>,
                true)
            )}

            {row(<>
              {col(
                <Field label="Fire Compliance Certification Type" tooltip="E.g. in Bangalore there is Fire Advisory, or Fire NOC.">
                  <TextInput mobile={m} value={values.fire_compliance_cert_type} onChange={set('fire_compliance_cert_type')} placeholder="Fire Compliance Certifications" />
                </Field>,
                true)}
              {col(
                <Field label="Vaastu Compliance">
                  <ToggleSwitch checked={values.vaastuCompliance} onChange={set('vaastuCompliance')} />
                </Field>,
                true)}
            </>)}

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
                <Field label="CAM" tooltip="Common Area Maintenance charges.">
                  <TextInput mobile={m} value={values.cam} onChange={set('cam')} placeholder="CAM charges" />
                </Field>,
                true)
            )}

          </Section>

          {visible && initialData && (
            <WarehouseProximityFields
              warehouse={initialData}
              coordinates={{ latitude: values.latitude, longitude: values.longitude }}
              disabled
            />
          )}

          {/* ── Metadata ────────────────────────────────────────── */}
          <Section title="Metadata">
            {initialData && row(
              col(
                <Field label="Last edited by">
                  <TextInput mobile={m} value={initialData.lastEditedBy || ''} onChange={() => {}} readOnly placeholder="Not recorded" />
                </Field>,
                true)
            )}
            {row(
              col(
                <Field label="Visibility">
                  <ToggleSwitch checked={values.visibility} onChange={set('visibility')} yesLabel="Visible" noLabel="Hidden" />
                </Field>,
                true)
            )}

            <Field label="Upload Files">
              <FileUpload value={values.media} onChange={set('media')} imageRecords={initialData?.images} disabled={availabilityOnly} />
            </Field>
          </Section>

          {/* ── Scout Notes ─────────────────────────────────────── */}
          <Section title="Scout Notes">
            <VoiceNotesList key={String(initialData?.id)} recordId={initialData?.id}
              notes={values.scoutVoiceNotes} onChange={set('scoutVoiceNotes')} disabled={availabilityOnly || submitting || loading} />
            <Field label="Notes">
              <TextAreaInput
                mobile={m}
                value={values.scoutNotes}
                onChange={set('scoutNotes')}
                placeholder="Extra notes from the scout — field observations, client suitability, or anything else worth mentioning."
                rows={m ? 8 : 6}
              />
            </Field>
          </Section>

          {/* ── Visit Notes (saved instantly via API; only for persisted master
                 warehouses — hidden in create mode and for staged review rows) ── */}
          {typeof initialData?.id === 'number' && (
            <Section title="Visit Notes">
              <VisitNotes warehouseId={initialData.id} editable={!availabilityOnly} />
            </Section>
          )}

          {/* ── WOG Verification (distinct) ──────────────────────── */}
          <div
            style={{
              marginTop: 20,
              padding: m ? 14 : 16,
              border: '1px solid var(--border-primary, #303030)',
              borderRadius: 8,
              background: 'var(--bg-secondary, transparent)',
              display: 'flex',
              flexDirection: m ? 'column' : 'row',
              alignItems: m ? 'flex-start' : 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                WOG Verified
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Mark this warehouse as verified by Wareongo.
              </div>
            </div>
            <ToggleSwitch checked={values.wogVerified} onChange={set('wogVerified')} />
          </div>
          </ProtectedFields>

          </div>

          {/* ── Actions ─────────────────────────────────────────── */}
          <div
            className={m ? `warehouse-form-actions${reviewActions ? ' warehouse-form-actions--review' : ''}` : ''}
            style={{
              marginTop: m ? 0 : 32,
              display: 'flex',
              flexDirection: m ? 'column' : 'row',
              justifyContent: 'flex-end',
              gap: 12,
              position: availabilityOnly && !m ? 'sticky' : 'static',
              bottom: m || availabilityOnly ? 0 : 'auto',
              background: m || availabilityOnly ? 'var(--bg-secondary)' : 'transparent',
              padding: m ? '12px 16px' : availabilityOnly ? '12px 0' : 0,
              borderTop: m || availabilityOnly ? '1px solid var(--border-primary)' : 'none',
              zIndex: availabilityOnly ? 10 : undefined,
            }}
          >
            {reviewActions && (
              <div className="warehouse-form-review-actions" style={{ display: 'flex', gap: 12, marginRight: m ? 0 : 'auto', order: m ? 3 : 0 }}>
                {typeof reviewActions === 'function'
                  ? reviewActions({ getPayload: buildPayload, validate })
                  : reviewActions}
              </div>
            )}
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
              icon={submitting ? null : <SaveOutlined aria-hidden="true" />}
              loading={submitting}
              disabled={loading}
              style={{ minWidth: 120, minHeight: m ? 44 : 'auto', order: m ? 1 : 2, flex: m ? '1' : 'none' }}
            >
              {submitting ? (m ? 'Saving...' : 'Saving') : availabilityOnly ? 'Update availability' : `${initialData ? 'Update' : 'Create'} Warehouse`}
            </Button>
          </div>
        </form>
      </Spin>
    </ResponsiveModal>
  );
};

export default WarehouseForm;
