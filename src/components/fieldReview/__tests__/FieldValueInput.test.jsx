import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FieldValueInput from '../FieldValueInput';
import { fromInput, toInput, formatValue } from '../values';

function Editor({ field, initial, warehouse, submit }) {
  const [value, setValue] = useState(() => toInput(initial, field));
  const [error, setError] = useState('');
  return <><FieldValueInput field={field} value={value} onChange={setValue} warehouse={warehouse} />
    <button onClick={() => {
      try { submit(fromInput(value, field)); setError(''); } catch (e) { setError(e.message); }
    }}>Serialize response</button>{error && <p role="alert">{error}</p>}</>;
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Serialize response' }));

it('adds/removes ordered numeric area values using the edit form control', () => {
  const submit = vi.fn();
  render(<Editor field={{ key: 'totalSpaceSqft', type: 'integerList', label: 'Offered Area (sq ft)' }} initial={[1000]} submit={submit} />);
  fireEvent.change(screen.getByLabelText('Proposed Offered Area (sq ft)'), { target: { value: '48000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Space Value' }));
  fireEvent.change(screen.getByLabelText('Proposed Offered Area (sq ft) · Space 2'), { target: { value: '24000' } });
  save();
  expect(submit).toHaveBeenLastCalledWith([48000, 24000]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove space value 1' }));
  save();
  expect(submit).toHaveBeenLastCalledWith([24000]);
});

it('shares measurement typing feedback, units and serialization', () => {
  const submit = vi.fn();
  render(<Editor field={{ key: 'clearHeightFt', type: 'text', label: 'Clear Height' }} initial="32" submit={submit} />);
  fireEvent.change(screen.getByLabelText('Clear Height value'), { target: { value: '50x' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Use digits and at most one decimal point');
  save();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Clear Height value'), { target: { value: '50.5' } });
  fireEvent.change(screen.getByLabelText('Clear Height unit'), { target: { value: 'metres' } });
  save();
  expect(submit).toHaveBeenLastCalledWith('50.5 metres');
  expect(formatValue('32', { key: 'clearHeightFt' })).toBe('32 feet');
});

it('keeps a legacy dropdown value visible until a new option is selected', () => {
  const submit = vi.fn();
  render(<Editor field={{ key: 'warehouseType', type: 'text', label: 'Warehouse Type' }} initial="Old-style godown" submit={submit} />);
  expect(screen.getByRole('option', { name: 'Old-style godown (current)' }).selected).toBe(true);
  fireEvent.change(screen.getByLabelText('Proposed Warehouse Type'), { target: { value: 'Shed' } });
  save();
  expect(submit).toHaveBeenLastCalledWith('Shed');
});

it('uses the shared searchable City options for the supplied State', () => {
  const submit = vi.fn();
  render(<Editor field={{ key: 'city', type: 'text', label: 'City' }} initial="Legacy city" warehouse={{ state: 'Maharashtra' }} submit={submit} />);
  const input = screen.getByRole('combobox', { name: 'Proposed City' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'Bhiwandi' } });
  fireEvent.mouseDown(screen.getByRole('option', { name: 'Bhiwandi' }));
  save();
  expect(submit).toHaveBeenLastCalledWith('Bhiwandi');
});

it.each([
  ['is_builder', 'boolean', true, false],
  ['ccRoads', 'text', 'Yes', 'false'],
  ['insulationPresent', 'text', 'true', 'false'],
  ['warehouseData.vaastuCompliance', 'text', 'false', 'true'],
])('keeps the stored type when using the %s switch', (key, type, initial, expected) => {
  const submit = vi.fn();
  render(<Editor field={{ key, type, label: 'Test toggle' }} initial={initial} submit={submit} />);
  fireEvent.click(screen.getByRole('switch', { name: 'Proposed Test toggle' }));
  save();
  expect(submit).toHaveBeenLastCalledWith(expected);
});

it('uses readable multi-select and water supply labels without changing stored codes', () => {
  expect(formatValue(['FNB', 'ECOMMERCE'], { key: 'suitableFor' })).toBe('FnB, E-Commerce');
  expect(formatValue('BOREWELL', { key: 'waterSupply' })).toBe('Borewell');
  const submit = vi.fn();
  render(<Editor field={{ key: 'waterSupply', type: 'select', label: 'Water Supply' }} initial="BOREWELL" submit={submit} />);
  fireEvent.change(screen.getByLabelText('Proposed Water Supply'), { target: { value: 'Pipeline' } });
  save();
  expect(submit).toHaveBeenLastCalledWith('PIPELINE');
});

const availabilityField = { key: 'availabilityReview', type: 'availabilityReview', label: 'Availability & last reviewed' };
it('edits the availability pair together without carrying the previous answer’s review date', async () => {
  const submit = vi.fn();
  const initial = { availability: 'Yes', availabilityLastReviewedOn: '2026-11-10' };
  expect(formatValue(initial, availabilityField)).toBe('Availability: Yes\nLast reviewed: 10 Nov 2026');
  render(<Editor field={availabilityField} initial={initial} submit={submit} />);
  const date = screen.getByLabelText('Proposed availability last reviewed');
  expect(date).toHaveValue('10/11/2026');
  fireEvent.change(screen.getByLabelText('Proposed availability'), { target: { value: 'No' } });
  expect(date).toHaveValue('');
  save();
  expect(submit).toHaveBeenLastCalledWith({ availability: 'No', availabilityLastReviewedOn: null });
  fireEvent.focus(date);
  fireEvent.change(date, { target: { value: '16/11/2026' } });
  fireEvent.keyDown(date, { key: 'Enter', code: 'Enter' });
  fireEvent.blur(date);
  await waitFor(() => expect(date).toHaveValue('16/11/2026'));
  save();
  expect(submit).toHaveBeenLastCalledWith({ availability: 'No', availabilityLastReviewedOn: '2026-11-16' });
});

it('validates the availability answer and review date as one response', () => {
  expect(() => fromInput({ availability: '', availabilityLastReviewedOn: '2026-11-16' }, availabilityField)).toThrow('Select availability');
  expect(() => fromInput({ availability: 'Yes', availabilityLastReviewedOn: '9999-01-01' }, availabilityField)).toThrow('future');
  expect(fromInput(toInput({ availability: null, availabilityLastReviewedOn: null }, availabilityField), availabilityField))
    .toEqual({ availability: null, availabilityLastReviewedOn: null });
});
