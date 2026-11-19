import { useId } from 'react';
import { MeasurementField, PhoneField, VentilationField, WashroomField } from '../StructuredFields';
import { TextInput, TextAreaInput, SelectInput, MultiSelectInput, ComboBox, DateInput, ToggleSwitch, OfferedAreaInput, HandoverInput } from '../WarehouseFormControls';
import { MEASUREMENTS, LAND_TYPES, CANOPY_TYPES, DOCK_PLATFORM_TYPES, FLOORING_TYPES } from '../../utils/formFields';
import { ZONES, POLLUTION_ZONES, BROKER_OPTIONS, STATUS_OPTIONS, OWNER_TYPES, OWNER_WARMTH_OPTIONS, INDIA_STATE_CITIES, INDIA_STATES, LISTING_TYPES, YES_NO } from '../../utils/warehouseFormOptions';
import { WAREHOUSE_TYPES } from '../../utils/warehouseOptions';
import { WATER_SUPPLY_OPTIONS, waterSupplyToEnum, waterSupplyToLabel } from '../../utils/waterSupply';
import { SUITABLE_FOR_OPTIONS } from '../../utils/suitableFor';
import { handoverTypeToEnum, handoverTypeToLabel, handoverUnitToEnum, handoverUnitToLabel } from '../../utils/handover';
import { todayInIndia } from '../../utils/availabilityReview';
import { useViewport } from '../../hooks/useViewport';
import FileUpload from '../FileUpload';

const choices = {
  listing_type: LISTING_TYPES, warehouseOwnerType: OWNER_TYPES, warehouseType: WAREHOUSE_TYPES,
  isBroker: BROKER_OPTIONS, owner_warmnth: OWNER_WARMTH_OPTIONS, owner_of_multiple_sites: YES_NO,
  status: STATUS_OPTIONS, zone: ZONES, pollutionZone: POLLUTION_ZONES,
  landType: LAND_TYPES, canopyType: CANOPY_TYPES, dockPlatformType: DOCK_PLATFORM_TYPES, flooringType: FLOORING_TYPES,
};
const clearableChoices = new Set(['canopyType', 'dockPlatformType', 'flooringType']);
const stringToggles = new Set(['ccRoads', 'insulationPresent', 'vaastuCompliance']);

function ValueControl({ field, value, onChange, id, disabled = false, warehouse = {}, requestPresignedUrl, onUploadingChange }) {
  const { isMobile: mobile } = useViewport();
  const generatedId = useId();
  const props = { id, disabled, mobile, 'aria-label': 'Proposed ' + field.label };
  const leaf = field.key.split('.').at(-1);
  if (field.type === 'media') return <div>
    <FileUpload value={value} onChange={onChange} disabled={disabled} imageRecords={warehouse.images}
      requestPresignedUrl={requestPresignedUrl} onUploadingChange={onUploadingChange}
      maxFiles={200} />
    <p className="fr-help">Add missing files or remove files from the proposed gallery. Changes appear in the warehouse only after verification.</p>
  </div>;
  const structured = MEASUREMENTS[leaf]
    ? <MeasurementField field={leaf} value={value} onChange={onChange} />
    : field.sensitive ? <PhoneField field={leaf} label={'Proposed ' + field.label} value={value} onChange={onChange} required={leaf === 'contactNumber'} />
      : leaf === 'washroom_count' ? <WashroomField value={value} onChange={onChange} />
        : leaf === 'ventilationType' ? <VentilationField value={value} onChange={onChange} /> : null;
  if (structured) return <fieldset className="fr-structured" disabled={disabled}>{structured}</fieldset>;
  if (field.type === 'availabilityReview') {
    const availabilityId = (id || generatedId) + '-availability';
    const dateId = (id || generatedId) + '-review-date';
    const pair = value || {};
    return <fieldset className="fr-structured" disabled={disabled} aria-label="Proposed availability and last reviewed">
      <div className="fr-linked-inputs">
        <div><label className="fr-label" htmlFor={availabilityId}>Availability</label>
          <SelectInput id={availabilityId} mobile={mobile} disabled={disabled} aria-label="Proposed availability"
            value={pair.availability} options={YES_NO} placeholder="Select availability"
            onChange={next => onChange({ ...pair, availability: next, availabilityLastReviewedOn: next === pair.availability ? pair.availabilityLastReviewedOn : '' })} />
        </div>
        <div><label className="fr-label" htmlFor={dateId}>Availability last reviewed</label>
          <DateInput id={dateId} mobile={mobile} disabled={disabled} aria-label="Proposed availability last reviewed"
            value={pair.availabilityLastReviewedOn} onChange={next => onChange({ ...pair, availabilityLastReviewedOn: next })}
            disabledDate={date => date.format('YYYY-MM-DD') > todayInIndia()} />
        </div>
      </div>
      <p className="fr-help">Changing availability clears its previous review date. Enter the date you checked this answer, or leave it blank if unknown.</p>
    </fieldset>;
  }
  if (leaf === 'state') return <ComboBox {...props} value={value} onChange={onChange} options={INDIA_STATES} placeholder="Select state" />;
  if (leaf === 'city') return <>
    <ComboBox {...props} disabled={disabled || !warehouse.state} value={value} onChange={onChange}
      options={INDIA_STATE_CITIES[warehouse.state] || []} placeholder="Select city" />
    <p className="fr-help">Cities in {warehouse.state || 'the selected state'}. State and Zone are reviewed separately.</p>
  </>;
  if (choices[leaf]) return <SelectInput {...props} value={value} onChange={onChange}
    options={choices[leaf]} placeholder={`Select ${field.label.toLowerCase()}`} allowClear={clearableChoices.has(leaf)} />;
  if (leaf === 'waterSupply') return <SelectInput {...props} value={waterSupplyToLabel(value)}
    onChange={v => onChange(waterSupplyToEnum(v))} options={WATER_SUPPLY_OPTIONS} placeholder="Select water supply" />;
  if (field.type === 'boolean' || stringToggles.has(leaf)) return <ToggleSwitch id={id} disabled={disabled} aria-label={props['aria-label']}
    checked={value === 'true'} onChange={v => onChange(String(v))} />;
  if (field.type === 'select') return <SelectInput {...props} value={value} onChange={onChange} options={field.options} placeholder="Select an option" />;
  if (field.type === 'multiSelect') return <MultiSelectInput {...props} value={value} onChange={onChange}
    options={leaf === 'suitableFor' ? SUITABLE_FOR_OPTIONS : field.options.map(option => ({ label: option, value: option }))} placeholder="Select use-cases" />;
  if (field.type === 'integerList') return <OfferedAreaInput {...props} value={value} onChange={onChange} label={'Proposed ' + field.label} />;
  if (field.type === 'handover') {
    const v = value || {};
    return <HandoverInput mobile={mobile} disabled={disabled} labelPrefix="Proposed handover"
      value={{ ...v, handoverType: handoverTypeToLabel(v.handoverType), handoverLeadUnit: handoverUnitToLabel(v.handoverLeadUnit) }}
      onChange={(key, next) => onChange({ ...v, [key]: key === 'handoverType' ? handoverTypeToEnum(next) : key === 'handoverLeadUnit' ? handoverUnitToEnum(next) : next })} />;
  }
  if (field.type === 'textarea') return <TextAreaInput {...props} value={value} onChange={onChange} maxLength={10000} rows={mobile ? 3 : 2} />;
  if (field.type === 'date') return <DateInput {...props} value={value} onChange={onChange} />;
  return <TextInput {...props} value={value} onChange={onChange} type={leaf === 'googleLocation' ? 'url' : 'text'} inputMode={field.type === 'number' ? 'decimal' : undefined} />;
}

export default function FieldValueInput(props) {
  return <div className="warehouse-field-controls"><ValueControl {...props} /></div>;
}
