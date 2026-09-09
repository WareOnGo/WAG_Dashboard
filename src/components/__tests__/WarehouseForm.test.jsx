import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import WarehouseForm from '../WarehouseForm';

// Visit notes persist independently of the form; uploads have a separate API
// boundary. These tests exercise the real form and its submitted payload.
vi.mock('../VisitNotes', () => ({ default: () => <div>Visit notes</div> }));

const record = {
  ...mockWarehouse, listing_type: 'Rent', warehouseType: 'PEB',
  state: 'Karnataka', city: 'Bangalore', zone: 'SOUTH', photos: '', media: null,
};
const field = label => {
  const node = screen.getByText((_, element) => element.tagName === 'LABEL'
    && element.textContent.replace(/\s*\*\s*$/, '').trim() === label);
  return node.parentElement.querySelector('input, textarea, select, [role="switch"]');
};
const change = (label, value) => fireEvent.change(field(label), { target: { value } });
const chooseLocation = (label, value) => {
  fireEvent.focus(field(label));
  fireEvent.change(field(label), { target: { value } });
  fireEvent.mouseDown(screen.getByText(value, { selector: 'li' }));
};
const open = (overrides = {}) => {
  const props = { visible: true, onSubmit: vi.fn().mockResolvedValue({}), onCancel: vi.fn(), ...overrides };
  return { props, ...renderWithProviders(<WarehouseForm {...props} />) };
};
const submit = () => act(async () => {
  fireEvent.click(screen.getByText(/^(Create|Update) Warehouse$/).closest('button'));
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('WarehouseForm current fields and payload', () => {
  it('renders current sections and a native warehouse-type selection', () => {
    open();
    expect(screen.getByText('Create New Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Owner Details')).toBeInTheDocument();
    expect(screen.getByText('Location Details')).toBeInTheDocument();
    expect(field('Warehouse Type')).toHaveRole('combobox');
    expect(field('Offered Area (sq ft)')).toHaveValue('1000');
    expect(field('City')).toBeDisabled();
  });

  it('does not render a closed form', () => {
    open({ visible: false });
    expect(screen.queryByText('Create New Warehouse')).not.toBeInTheDocument();
  });

  it('preserves legacy select values while editing', () => {
    open({ initialData: { ...record, warehouseType: 'Industrial', state: 'Legacy State', city: 'Legacy City' } });
    expect(field('Warehouse Type')).toHaveValue('Industrial');
    expect(field('State')).toHaveValue('Legacy State');
    expect(field('City')).toHaveValue('Legacy City');
    expect(field('Contact Number')).toHaveValue(record.contactNumber);
  });

  it('rejects an incomplete submission with current field-specific errors', async () => {
    const { props } = open();
    await submit();
    expect(await screen.findByText('Listing type is required')).toBeInTheDocument();
    expect(screen.getByText('Warehouse type is required')).toBeInTheDocument();
    expect(screen.getByText('Contact number is required')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('submits a new warehouse with the default area and derived zone', async () => {
    const { props } = open();
    change('Listing Type', 'Rent');
    change('Warehouse Type', 'PEB');
    change('Address', 'Nelamangala');
    chooseLocation('State', 'Karnataka');
    chooseLocation('City', 'Bangalore');
    change('Contact Person', 'Test Owner');
    change('Contact Number', '9876543210');
    change('Rate per sq ft', '25');
    change('Uploaded By', 'Test Employee');
    change('Compliances', 'Fire Safety');
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      listing_type: 'Rent', warehouseType: 'PEB', city: 'Bangalore', state: 'Karnataka', zone: 'SOUTH',
      contactNumber: '9876543210', totalSpaceSqft: [1000], ratePerSqft: '25',
      suitableFor: [], warehouseData: expect.objectContaining({ latitude: null, longitude: null }),
    }));
  });

  it('submits edited values and preserves coordinate precision', async () => {
    const { props } = open({ initialData: record });
    change('Address', 'Updated locality');
    change('Latitude', '12.9716123456789');
    change('Longitude', '77.5946123456789');
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      address: 'Updated locality', totalSpaceSqft: [10000, 5000],
      warehouseData: expect.objectContaining({ latitude: '12.9716123456789', longitude: '77.5946123456789' }),
    }));
  });

  it('adds an area and includes both numeric values in the submission', async () => {
    const { props } = open({ initialData: { ...record, totalSpaceSqft: [1000] } });
    fireEvent.click(screen.getByText('Add Space Value').closest('button'));
    const areas = screen.getAllByPlaceholderText('Enter space');
    expect(areas).toHaveLength(2);
    fireEvent.change(areas[1], { target: { value: '2500' } });
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    expect(props.onSubmit.mock.lastCall[0].totalSpaceSqft).toEqual([1000, 2500]);
  });

  it('rejects a warehouse whose offered areas are all empty or zero', async () => {
    const { props } = open({ initialData: { ...record, totalSpaceSqft: [0] } });
    await submit();
    expect(await screen.findByText('At least one space value is required')).toBeInTheDocument();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('clears the city on state change and respects a manually chosen zone', () => {
    open({ initialData: record });
    change('Zone', 'WEST');
    chooseLocation('State', 'Tamil Nadu');
    expect(field('City')).toHaveValue('');
    expect(field('Zone')).toHaveValue('WEST');
  });

  it('preserves hidden RCC details when changing the warehouse type', async () => {
    const { props } = open({ initialData: { ...record, warehouseType: 'RCC', totalFloors: 'G+3', liftAccess: true, liftLoadCapacity: '2T' } });
    expect(screen.getByPlaceholderText('e.g. G+3')).toHaveValue('G+3');
    change('Warehouse Type', 'PEB');
    expect(screen.queryByPlaceholderText('e.g. G+3')).not.toBeInTheDocument();
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
    expect(props.onSubmit.mock.lastCall[0]).toEqual(expect.objectContaining({ totalFloors: 'G+3', liftAccess: true, liftLoadCapacity: '2T' }));
  });
});

describe('WarehouseForm submission and edit lifecycle', () => {
  it('keeps entered values on a failed save so the user can retry', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { props } = open({ initialData: record, onSubmit: vi.fn().mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce({}) });
    change('Address', 'Keep this locality');
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(field('Address')).toHaveValue('Keep this locality');
    await waitFor(() => expect(screen.getByText('Update Warehouse').closest('button')).not.toHaveClass('ant-btn-loading'));
    await submit();
    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(2));
    expect(props.onSubmit.mock.lastCall[0].address).toBe('Keep this locality');
    error.mockRestore();
  });

  it('prevents repeated clicks while a save is pending', async () => {
    let finish;
    const { props } = open({ initialData: record, onSubmit: vi.fn(() => new Promise(resolve => { finish = resolve; })) });
    await submit();
    expect(await screen.findByText('Saving', { selector: 'button span' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Saving', { selector: 'button span' }).closest('button'));
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => finish({}));
  });

  it('disables submission while externally loading', () => {
    open({ initialData: record, loading: true });
    expect(screen.getByText('Update Warehouse').closest('button')).toBeDisabled();
  });

  it('resets the draft when cancelled and reopened in create mode', async () => {
    const view = open();
    change('Contact Person', 'Discard this draft');
    fireEvent.click(screen.getByText('Cancel').closest('button'));
    expect(view.props.onCancel).toHaveBeenCalledTimes(1);
    view.rerender(<WarehouseForm {...view.props} visible={false} />);
    view.rerender(<WarehouseForm {...view.props} />);
    expect(field('Contact Person')).toHaveValue('');
    expect(field('Offered Area (sq ft)')).toHaveValue('1000');
  });

  it('fills the background contact number without losing other edits', () => {
    const view = open({ initialData: { ...record, contactNumber: '******7890' } });
    change('Address', 'Draft locality');
    view.rerender(<WarehouseForm {...view.props} initialData={{ ...record, contactNumber: '9876543210' }} />);
    expect(field('Contact Number')).toHaveValue('9876543210');
    expect(field('Address')).toHaveValue('Draft locality');
  });

  it('does not overwrite a contact number the user has edited', () => {
    const view = open({ initialData: { ...record, contactNumber: '******7890' } });
    change('Contact Number', '9123456789');
    view.rerender(<WarehouseForm {...view.props} initialData={{ ...record, contactNumber: '9876543210' }} />);
    expect(field('Contact Number')).toHaveValue('9123456789');
  });
});
