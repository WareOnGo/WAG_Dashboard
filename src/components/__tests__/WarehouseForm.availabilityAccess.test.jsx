import { it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import WarehouseForm from '../WarehouseForm';
import { AVAILABILITY_FIELDS } from '../../utils/warehousePermissions';

vi.mock('../VisitNotes', () => ({ default: ({ editable }) => <div data-testid="visit-notes" data-editable={String(editable)} /> }));

const original = { id: 124, uploadedBy: 'colleague@wareongo.com', availability: 'Yes',
  status: null, handoverType: null, handoverDate: null, handoverLeadValue: null, handoverLeadUnit: null,
  address: 'Original address', WarehouseData: {}, WarehouseProximity: [], contactNumber: undefined, carpet_area: 'legacy measurement' };
const change = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const open = (initialData = original) => {
  const onSubmit = vi.fn().mockResolvedValue({});
  renderWithProviders(<WarehouseForm visible availabilityOnly initialData={initialData} onSubmit={onSubmit} onCancel={vi.fn()} />);
  return onSubmit;
};
const submit = () => fireEvent.click(screen.getByText('Update availability').closest('button'));

it('keeps the entire Availability section editable and sends no unrelated fields on incomplete legacy entries', async () => {
  const onSubmit = open();
  for (const label of ['Availability', 'Availability last reviewed', 'Handover mode', 'Lock-in Date', 'Status']) {
    expect(screen.getByLabelText(label, { exact: true })).not.toBeDisabled();
  }
  for (const text of ['Owner Details', 'Location Details', 'Metadata', 'Visit Notes', 'WOG Verified']) {
    expect(screen.getByText(text, { exact: true })).toBeInTheDocument();
  }
  for (const label of ['Listing Type', 'Address', 'State', 'Contact Number', 'Visibility']) {
    expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeDisabled();
  }
  expect(screen.getByText('Add Files').closest('button')).toBeDisabled();
  expect(screen.getByTestId('visit-notes')).toHaveAttribute('data-editable', 'false');
  fireEvent.change(screen.getByLabelText(/^Address/), { target: { value: 'Unauthorized change' } });
  expect(screen.getByLabelText(/^Address/)).toHaveValue(original.address);
  change('Availability', 'No');
  change('Status', 'Ready to move');
  submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  const payload = onSubmit.mock.calls[0][0];
  expect(payload).toMatchObject({ availability: 'No', status: 'Ready to move',
    expectedFormValues: { status: null, lockInDate: null },
    expectedAvailability: { availability: 'Yes', availabilityLastReviewedOn: null } });
  expect(payload).not.toHaveProperty('handoverDate');
  expect(Object.keys(payload).every(key => [...AVAILABILITY_FIELDS, 'expectedFormValues', 'expectedAvailability'].includes(key))).toBe(true);
});

it('requires complete variable handover and preserves inactive fixed timing', async () => {
  const onSubmit = open({ ...original, handoverType: 'FIXED', handoverDate: '2027-01-10' });
  change('Handover mode', 'Variable');
  change('Handover lead time', '2');
  submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Handover unit')).toHaveAttribute('aria-invalid', 'true');
  change('Handover unit', 'Months');
  submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ handoverType: 'VARIABLE',
    handoverLeadValue: 2, handoverLeadUnit: 'MONTHS' });
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('handoverDate');
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('status');
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('lockInDate');
});

it('rejects an edited out-of-range lead time', () => {
  const onSubmit = open({ ...original, handoverType: 'VARIABLE', handoverLeadValue: 1, handoverLeadUnit: 'MONTHS' });
  change('Handover lead time', '121');
  submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Handover lead time')).toHaveAttribute('aria-invalid', 'true');
});

it('does not resend or require correction of unchanged legacy timing during an unrelated edit', async () => {
  const onSubmit = open({ ...original, availabilityLastReviewedOn: '2999-01-01', handoverType: 'VARIABLE', handoverLeadValue: 121, handoverLeadUnit: 'MONTHS' });
  change('Status', 'Under construction');
  submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  expect(Object.keys(onSubmit.mock.calls[0][0]).sort()).toEqual(['expectedFormValues', 'status']);
});

it('preserves a failed edit for retry', async () => {
  const onSubmit = open();
  onSubmit.mockRejectedValueOnce(new Error('Save failed'));
  change('Status', 'Ready to move');
  await act(async () => submit());
  await waitFor(() => expect(screen.getByText('Update availability').closest('button')).toBeEnabled());
  expect(screen.getByLabelText('Status')).toHaveValue('Ready to move');
  submit();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
});
