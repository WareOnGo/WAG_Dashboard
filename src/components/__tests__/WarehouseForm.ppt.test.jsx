import { test, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { completePptForm } from '../../test/pptFormFixture';
import WarehouseForm from '../WarehouseForm';
vi.mock('../VisitNotes', () => ({ default: () => null }));
const controls = ['clearHeightFt', 'floorStrengthPerSqm', 'numberOfDocks', 'plinthHeightFt', 'canopyType', 'flooringType',
  'ventilationType', 'powerKva', 'washroom_count', 'fireNocAvailable', 'fireSafetyMeasures'];
const input = key => document.querySelector(`[data-field="${key}"]`);
const change = (key, value) => fireEvent.change(input(key), { target: { value } });
function open(overrides = {}) {
  const row = completePptForm();
  const onSubmit = vi.fn().mockResolvedValue({});
  renderWithProviders(<WarehouseForm visible initialData={{ ...row, id: 123, WarehouseData: row.warehouseData, ...overrides }}
    onSubmit={onSubmit} onCancel={vi.fn()} />, { auth: { user: { email: 'editor@example.test' } } });
  return onSubmit;
}
const submit = () => act(async () => fireEvent.click(screen.getByText('Update Warehouse', { exact: true }).closest('button')));
test.each(controls)('a saved %s cannot be cleared through the dashboard form', async key => {
  const onSubmit = open();
  if (key === 'ventilationType') {
    fireEvent.click(input(key)); fireEvent.click(screen.getByRole('checkbox', { name: 'None' }));
  } else if (key === 'powerKva') fireEvent.click(screen.getByLabelText('As per requirement'));
  else {
    change(key, '');
    if (key === 'washroom_count') change('femaleWashrooms', '');
  }
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input(key)).toHaveAttribute('aria-invalid', 'true');
});
test('old missing specifications and unknown Fire NOC remain missing on an unrelated edit', async () => {
  const missing = Object.fromEntries(controls.map(key => [key, null]));
  const onSubmit = open({ ...missing, handoverDate: null, WarehouseData: { landType: 'Warehouse CLU', powerKva: null, fireNocAvailable: null, fireSafetyMeasures: null } });
  expect(input('fireNocAvailable')).toHaveValue('');
  change('address', 'Updated locality');
  await submit();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ clearHeightFt: null, handoverDate: null,
    warehouseData: expect.objectContaining({ fireNocAvailable: null, powerKva: null }) }));
});
test('switching a known handover to an incomplete mode blocks save and highlights both parts', async () => {
  const onSubmit = open();
  fireEvent.change(screen.getByLabelText('Handover mode'), { target: { value: 'Variable' } });
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input('handoverLeadValue')).toHaveAttribute('aria-invalid', 'true');
  expect(input('handoverLeadUnit')).toHaveAttribute('aria-invalid', 'true');
  change('handoverLeadValue', '2'); change('handoverLeadUnit', 'Weeks');
  await submit();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ handoverType: 'VARIABLE', handoverLeadValue: 2, handoverLeadUnit: 'WEEKS' }));
});
test.each(['washroom_count', 'femaleWashrooms'])('a previously known %s cannot be removed while the other count remains', async key => {
  const onSubmit = open({ washroom_count: 'Male: 3; Female: 2' });
  change(key, '');
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input(key)).toHaveAttribute('aria-invalid', 'true');
  change(key, '0');
  await submit();
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
test('background contact refresh does not rebase protected answers from an older open form', async () => {
  const row = completePptForm(), onSubmit = vi.fn().mockResolvedValue({});
  const original = { ...row, id: 123, WarehouseData: row.warehouseData };
  const props = { visible: true, initialData: original, onSubmit, onCancel: vi.fn() };
  const view = renderWithProviders(<WarehouseForm {...props} />, { auth: { user: { email: 'editor@example.test' } } });
  view.rerender(<WarehouseForm {...props} initialData={{ ...original, contactNumber: '9123456789',
    WarehouseData: { ...original.WarehouseData, powerKva: '200 kVA' } }} />);
  change('address', 'Changed locality');
  await submit();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    expectedFormValues: expect.objectContaining({ powerKva: 'As per requirement' }),
  }));
});
test('clearing a saved date then switching to Variable explains how to restore the hidden answer', async () => {
  const onSubmit = open({ handoverLeadValue: 2, handoverLeadUnit: 'WEEKS' });
  change('handoverDate', '');
  fireEvent.blur(input('handoverDate')); // The date picker commits typed clearing on blur.
  change('handoverType', 'Variable');
  await submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(input('handoverType')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getAllByText(/Switch to Fixed to correct the handover date/).length).toBeGreaterThan(0);
});
