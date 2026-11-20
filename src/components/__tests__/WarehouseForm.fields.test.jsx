import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import WarehouseForm from '../WarehouseForm';

vi.mock('../VisitNotes', () => ({ default: () => <div>Visit notes</div> }));
const original = { ...mockWarehouse, listing_type: 'Rent', warehouseType: 'PEB',
  state: 'Delhi', city: 'New Delhi', contactNumber: '+919876543210', uploadedBy: 'original@example.test',
  googleLocation: '', WarehouseData: { landType: '' }, media: null, photos: '', WarehouseProximity: [],
};
const auth = { user: { email: 'reviewer@example.test' } };
const open = (props = {}) => {
  const onSubmit = vi.fn().mockResolvedValue({});
  const view = renderWithProviders(<WarehouseForm visible initialData={original} onSubmit={onSubmit} onCancel={vi.fn()} {...props} />, { auth });
  return { ...view, onSubmit };
};
// Scope label queries to controls rather than repeatedly traversing every country option.
const field = label => {
  const explicit = document.querySelector(`[aria-label="${label}"]`);
  if (explicit) return explicit;
  const node = [...document.querySelectorAll('label')].find(el => el.textContent.replace(/\s*\*\s*$/, '').trim() === label);
  return node?.htmlFor ? document.getElementById(node.htmlFor) : node?.querySelector('input, select, textarea, [role="switch"]');
};
const change = (label, value) => fireEvent.change(field(label), { target: { value } });
const submit = () => act(async () => fireEvent.click(screen.getByText('Update Warehouse').closest('button')));
beforeEach(() => {
  vi.restoreAllMocks();
});

describe('structured dashboard fields', () => {
  it('cleans invisible characters from pasted primary and alternate phones before saving', async () => {
    const user = userEvent.setup();
    const { onSubmit } = open();
    await user.clear(field('Contact Number'));
    await user.paste('\u200e99800\u200b88303\u200f');
    expect(field('Contact Number')).toHaveValue('9980088303');
    await user.click(field('Alternate Phone Number'));
    await user.paste('\u2066+44\u00a020\u202f7946\u202f0123\u2069');
    expect(field('Alternate Phone Number country code')).toHaveValue('GB');
    expect(field('Alternate Phone Number')).toHaveValue('2079460123');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      contactNumber: '+919980088303', alt_phone_number: '+442079460123',
    }));
  });

  it('displays the stored last editor as read-only metadata without submitting it', async () => {
    const { onSubmit } = open({ initialData: { ...original, lastEditedBy: 'previous@example.test' } });
    expect(field('Last edited by')).toHaveValue('previous@example.test');
    expect(field('Last edited by')).toHaveAttribute('readonly');
    await submit();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('lastEditedBy');
  });

  it('shows character feedback before saving only for the new measurement inputs', () => {
    open();
    change('Clear Height value', '50x');
    expect(field('Clear Height value')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Use digits and at most one decimal point');
    change('Clear Height value', '50.5');
    change('Male washrooms', 'x');
    expect(field('Clear Height value')).toHaveAttribute('aria-invalid', 'false');
    expect(field('Male washrooms')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sends every measurement, phone, choice and washroom in the existing string fields', async () => {
    const { onSubmit } = open();
    for (const [label, value, unit] of [
      ['Distance from Highway', '2.5', 'km'], ['Approach Road Width', '50', 'feet'],
      ['Land Parcel Size', '2', 'hectares'], ['Built-up Area', '25000', 'sq ft'], ['Carpet Area', '0', 'sq ft'],
      ['Clear Height', '10', 'metres'], ['Centre Height', '12', 'metres'], ['Plinth Height', '0', 'feet'],
      ['Dock Apron Length', '15', 'metres'], ['Compound Gate Width', '20', 'feet'], ['Power', '100', 'HP'],
    ]) {
      change(`${label} value`, value);
      const unitInput = document.querySelector(`[aria-label="${label} unit"]`);
      if (unitInput) fireEvent.change(unitInput, { target: { value: unit } });
    }
    change('Dimensions length', '100'); change('Dimensions width', '60'); change('Dimensions height', '30');
    change('Dock Dimension width', '8'); change('Dock Dimension height', '10');
    change('Floor Strength value', '5'); change('Lighting value', '0');
    change('Male washrooms', '2'); change('Female washrooms', '0');
    change('Contact Number country code', 'GB'); change('Contact Number', '2079460018');
    change('Alternate Phone Number country code', 'DK'); change('Alternate Phone Number', '32123456');
    change('Canopy Type', 'Shutter'); change('Dock Platform Type', 'Angled/Cross'); change('Flooring Type', 'VDF');
    fireEvent.click(field('Ventilation Type options'));
    fireEvent.click(field('Ridge')); fireEvent.click(field('Turbo'));
    change('Ventilation Air Changes/Day', '4');
    expect(field('Nearest Bus Transport')).toBeFalsy();
    expect(field('Paved Roads inside Warehouse?')).toBeInTheDocument();
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      contactNumber: '+442079460018', alt_phone_number: '+4532123456', uploadedBy: original.uploadedBy,
      distance_from_highway: '2.5 km', land_parcel_size: '2 hectares', builtup_area: '25000 sq ft', carpet_area: '0 sq ft',
      clearHeightFt: '10 metres', centreHeight: '12 metres', plinthHeightFt: '0 feet', dockDimension: '8 x 10 feet',
      dockApronLengthFt: '15 metres', gateSizeFt: '20 feet', floorStrengthPerSqm: '5 tonnes/sq m', lightingDetails: '0 lux',
      washroom_count: 'Male: 2; Female: 0', canopyType: 'Shutter', dockPlatformType: 'Angled/Cross', flooringType: 'VDF',
      ventilationType: 'Ridge, Turbo', ventilationAirChangesPerDay: '4',
      warehouseData: expect.objectContaining({ approachRoadWidth: '50 feet', dimensions: '100 x 60 x 30 feet', powerKva: '100 HP' }),
    }));
  }, 30000);

  it('saves the checked Power option without validating the disabled numeric entry', async () => {
    const { onSubmit } = open();
    change('Power value', '50x');
    fireEvent.click(field('As per requirement'));
    expect(field('Power value')).toBeDisabled();
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      warehouseData: expect.objectContaining({ powerKva: 'As per requirement' }),
    }));
  });

  it('reopens checked Power and allows replacing it with a numeric value', async () => {
    const { onSubmit } = open({ initialData: { ...original, WarehouseData: { ...original.WarehouseData, powerKva: 'As per requirement' } } });
    expect(field('As per requirement')).toBeChecked();
    expect(field('Power unit')).toBeDisabled();
    fireEvent.click(field('As per requirement'));
    change('Power value', '75');
    change('Power unit', 'HP');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      warehouseData: expect.objectContaining({ powerKva: '75 HP' }),
    }));
  });

  it('preserves legacy ranges, descriptions, dropdown values, totals, setback, media and uploader', async () => {
    const legacy = { ...original, clearHeightFt: '20–25 feet', dimensions: '100 by 200', washroom_count: '5 total',
      ventilationType: 'Cross ventilation with fans', canopyType: 'Custom canopy', flooringType: 'Old stone',
      builtup_area: '25000', carpet_area: '120 sqm', land_parcel_size: '400 m²', googleLocation: 'legacy maps description', nearest_transport: 'Old bus stand',
      setbackArea: '5m on all sides', media: { images: ['https://fixture.invalid/owned.jpg'], videos: [], docs: [] },
      WarehouseData: { landType: 'Old land type', dimensions: '100 by 200', powerKva: '100–200 kVA' } };
    const { onSubmit } = open({ initialData: legacy });
    expect(screen.getByText('20–25 feet')).toBeInTheDocument();
    expect(field('Built-up Area unit')).toHaveValue('');
    change('Address', 'Unrelated edit');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      clearHeightFt: legacy.clearHeightFt, washroom_count: legacy.washroom_count, ventilationType: legacy.ventilationType,
      canopyType: legacy.canopyType, flooringType: legacy.flooringType, builtup_area: legacy.builtup_area,
      carpet_area: legacy.carpet_area, land_parcel_size: legacy.land_parcel_size,
      googleLocation: legacy.googleLocation, nearest_transport: legacy.nearest_transport, setbackArea: legacy.setbackArea,
      uploadedBy: legacy.uploadedBy, media: legacy.media, warehouseData: expect.objectContaining(legacy.WarehouseData),
    }));
  });

  it('blocks incomplete dimensions, negative counts and an invalid international number', async () => {
    const { onSubmit } = open();
    change('Dimensions length', '100'); change('Male washrooms', '-1');
    change('Contact Number country code', 'GB'); change('Contact Number', '12');
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field('Dimensions length')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Male washrooms')).toHaveAttribute('aria-invalid', 'true');
    expect(field('Contact Number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('requires changed location and land values, but preserves unchanged missing values', async () => {
    const { onSubmit } = open({ initialData: { ...original, googleLocation: 'old URL', WarehouseData: { landType: 'Warehouse CLU' } } });
    change('Google Location URL', '');
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    change('Google Location URL', 'https://www.google.com/maps?q=0,77');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ googleLocation: 'https://www.google.com/maps?q=0,77' }));
  });

  it('saves short Maps links without pin verification and preserves existing coordinates', async () => {
    const { onSubmit } = open({ initialData: { ...original,
      WarehouseData: { landType: 'Warehouse CLU', latitude: 0, longitude: 77 } } });
    const googleLocation = 'https://maps.app.goo.gl/ttMpsPTNwLcrdHas5';
    change('Google Location URL', googleLocation);
    expect(screen.queryByText('Location verified')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry location check' })).not.toBeInTheDocument();
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ googleLocation,
      warehouseData: expect.objectContaining({ latitude: 0, longitude: 77 }) }));
  });

  it('exposes validation to review actions without forcing errors during rejection', async () => {
    const approve = vi.fn(); const reject = vi.fn();
    open({ reviewActions: ({ validate, getPayload }) => <>
      <button type="button" onClick={() => { if (validate()) approve(getPayload()); }}>Test accept</button>
      <button type="button" onClick={() => reject(validate(true))}>Test reject</button>
    </> });
    change('Dock Dimension width', '8');
    fireEvent.click(screen.getByText('Test reject'));
    expect(reject).toHaveBeenCalledWith(false);
    expect(field('Dock Dimension width')).toHaveAttribute('aria-invalid', 'false');
    fireEvent.click(screen.getByText('Test accept'));
    expect(approve).not.toHaveBeenCalled();
    expect(field('Dock Dimension width')).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update Warehouse' })).toBeEnabled());
  });
});

it('allows review approval with an unchecked short Maps link', () => {
  const approve = vi.fn();
  open({ reviewActions: ({ validate, getPayload }) => <button type="button"
    onClick={() => { if (validate()) approve(getPayload()); }}>Test accept</button> });
  change('Google Location URL', 'https://maps.app.goo.gl/ttMpsPTNwLcrdHas5');
  fireEvent.click(screen.getByText('Test accept'));
  expect(approve).toHaveBeenCalledWith(expect.objectContaining({ googleLocation: 'https://maps.app.goo.gl/ttMpsPTNwLcrdHas5' }));
});
it('keeps missing primary contact validation when editing older records', async () => {
  const { onSubmit } = open({ initialData: { ...original, contactNumber: '' } });
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(field('Contact Number')).toHaveAttribute('aria-invalid', 'true');
});
