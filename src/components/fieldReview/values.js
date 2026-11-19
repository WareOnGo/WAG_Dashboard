import { MEASUREMENTS, serializeMeasurement, serializeWashrooms, serializeVentilation } from '../../utils/formFields';
import { serializePhone, phoneError } from '../../utils/phone';
import { formatHandover } from '../../utils/handover';
import { suitableForLabel } from '../../utils/suitableFor';
import { waterSupplyToLabel } from '../../utils/waterSupply';
import { withDefaultUnit } from '../../utils/measurementDisplay';
import { formatAvailabilityReview, todayInIndia } from '../../utils/availabilityReview';
const stringToggles = new Set(['ccRoads', 'insulationPresent', 'warehouseData.vaastuCompliance']);
export const STATUS_LABEL = {
  NEEDS_RESPONSE: 'Needs response',
  AWAITING_ADMIN: 'Awaiting reviewer',
  CHANGES_REQUESTED: 'Changes requested',
  VERIFIED: 'Verified & closed',
  CANCELLED: 'Cancelled'
};
export const isActiveFlag = flag => ['NEEDS_RESPONSE', 'AWAITING_ADMIN', 'CHANGES_REQUESTED'].includes(flag.status);
export const formatValue = (value, field = {}) => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(v => field.key === 'suitableFor' ? suitableForLabel(v) : typeof v === 'number' ? v.toLocaleString('en-IN') : String(v).replaceAll('_', ' ')).join(', ') : 'Not recorded';
  if (field.key === 'waterSupply') return waterSupplyToLabel(value);
  if (stringToggles.has(field.key) && /^(true|false|yes|no)$/i.test(String(value))) return /^(true|yes)$/i.test(String(value)) ? 'Yes' : 'No';
  if (field.type === 'availabilityReview' && typeof value === 'object') {
    return `Availability: ${value.availability || 'Not recorded'}\nLast reviewed: ${formatAvailabilityReview(value.availabilityLastReviewedOn)}`;
  }
  if (field.type === 'handover' && typeof value === 'object') {
    return formatHandover(value, date => date?.slice(0, 10)) || 'Not recorded';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const measurement = MEASUREMENTS[field.key?.split('.').at(-1)];
  if (measurement?.bareUnit) return withDefaultUnit(value, measurement.bareUnit);
  return String(value);
};
export const toInput = (value, field, masked = false) => {
  if (masked) return '';
  if (field.type === 'availabilityReview') return {
    availability: value?.availability ?? '',
    availabilityLastReviewedOn: value?.availabilityLastReviewedOn?.slice(0, 10) || ''
  };
  if (field.type === 'handover') return {
    handoverType: value?.handoverType || 'FIXED',
    handoverDate: value?.handoverDate || null,
    handoverLeadValue: value?.handoverLeadValue ?? null,
    handoverLeadUnit: value?.handoverLeadUnit || null
  };
  if (field.type === 'integerList') return value?.length ? value.map(String) : [''];
  if (field.type === 'multiSelect') return value || [];
  if (field.type === 'boolean' || stringToggles.has(field.key)) return /^(true|yes)$/i.test(String(value)) ? 'true' : 'false';
  return value == null ? '' : String(value);
};
export const fromInput = (value, field) => {
  const leaf = field.key?.split('.').at(-1);
  if (field.type === 'availabilityReview') {
    const availability = value.availability?.trim() || null;
    const date = value.availabilityLastReviewedOn || null;
    if (date && !availability) throw new Error('Select availability before recording a review date.');
    if (date && date > todayInIndia()) throw new Error('Review date cannot be in the future.');
    return { availability, availabilityLastReviewedOn: date };
  }
  if (MEASUREMENTS[leaf]) return serializeMeasurement(value, leaf);
  if (leaf === 'washroom_count') return serializeWashrooms(value);
  if (leaf === 'ventilationType') return serializeVentilation(value);
  if (field.sensitive) {
    const error = phoneError(value, {
      required: leaf === 'contactNumber'
    });
    if (error) throw new Error(error);
    return serializePhone(value);
  }
  if (field.type === 'handover') {
    const lead = value.handoverLeadValue;
    if (lead !== '' && lead != null && (!/^\d+$/.test(String(lead)) || Number(lead) < 1 || Number(lead) > 120)) {
      throw new Error('Lead time must be a whole number between 1 and 120');
    }
    return { ...value, handoverDate: value.handoverDate || null,
      handoverLeadValue: lead === '' || lead == null ? null : Number(lead), handoverLeadUnit: value.handoverLeadUnit || null };
  }
  if (field.type === 'integerList') {
    const parts = (Array.isArray(value) ? value : [value]).map(x => String(x ?? '').trim());
    if (!parts.length || parts.some(x => !x || !/^\d+$/.test(x) || Number(x) <= 0 || Number(x) > 2147483647)) throw new Error('Enter a positive whole number for every space value.');
    return parts.map(Number);
  }
  if (field.type === 'boolean') return value === 'true';
  if (stringToggles.has(field.key)) return value === 'true' ? 'true' : 'false';
  if (field.type === 'multiSelect') return value;
  if (field.type === 'number') {
    if (String(value).trim() === '') return null;
    if (!Number.isFinite(Number(value))) throw new Error('Enter a valid number.');
    return Number(value);
  }
  return value === '' ? null : value;
};
