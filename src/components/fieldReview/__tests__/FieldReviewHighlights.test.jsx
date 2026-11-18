import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import AuthContext from '../../../contexts/AuthContext';
import WarehouseDetailsModal from '../../WarehouseDetailsModal';
import CardView from '../../CardView';
import useFieldReviewHighlights from '../useFieldReviewHighlights';
import { fieldReviewService } from '../../../services/fieldReviewService';
import { fieldReviewAccessKey } from '../../../utils/fieldReviewPermissions';

vi.mock('../../../services/fieldReviewService', () => ({
  fieldReviewService: { summaries: vi.fn(), setup: vi.fn(), detail: vi.fn() },
}));
vi.mock('../../../services/imageLabelService', () => ({
  imageLabelService: { getCached: () => ({}) },
}));
vi.mock('../../VisitNotes', () => ({ default: () => null }));
vi.mock('../../VoiceNotesList', () => ({ default: () => null }));
vi.mock('../../WarehouseProximityFields', () => ({ default: () => null }));

const user = { email: 'observer@wareongo.com', isAdmin: false, isReviewer: false,
  capabilities: { DASHBOARD: true, WAREHOUSE_VIEW_OWN: true, WAREHOUSE_VIEW_ALL: true,
    WAREHOUSE_EDIT_OWN: false, WAREHOUSE_EDIT_ALL: false } };
const warehouse = { id: 4821, warehouseType: 'PEB', city: 'Bhiwandi', ratePerSqft: '22',
  availability: 'Yes', availabilityLastReviewedOn: '2026-11-10', passengerLiftCount: 2,
  WarehouseData: {}, imageLabels: {} };
const summary = (activeFieldKeys, warehouseId = 4821) => [{ warehouseId, activeFieldKeys,
  activeCount: activeFieldKeys.length, activeFields: activeFieldKeys.map(fieldKey => ({ fieldKey, comment: 'Check ' + fieldKey + '.' })),
  canOpen: false, reviewId: null }];
const openView = (row = warehouse) => render(<AuthContext.Provider value={{ user }}><App>
  <WarehouseDetailsModal visible warehouse={row} onClose={() => {}} />
</App></AuthContext.Provider>);
const initialProps = { warehouseId: 4821, visible: true, user };
beforeEach(() => {
  vi.clearAllMocks();
  fieldReviewService.summaries.mockReset().mockResolvedValue([]);
});

it('highlights the exact flagged fields for an unassigned viewer, including linked and otherwise hidden fields', async () => {
  fieldReviewService.summaries.mockResolvedValue(summary(['ratePerSqft', 'contactNumber', 'availabilityReview', 'passengerLiftCount']));
  openView();
  for (const label of ['Rate per sq ft', 'Contact Number', 'Availability', 'Availability last reviewed', 'Number of Passenger Lifts']) {
    const marker = await screen.findByLabelText(label + ' is flagged for review');
    expect(marker.closest('.fr-flag-field')).toHaveClass('fr-flag-field--active');
  }
  expect(document.querySelector('[data-review-field="city"]')).not.toHaveClass('fr-flag-field--active');
  expect(screen.getByText('4 flagged fields are highlighted below.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Flag for review (beta)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit for verification' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(fieldReviewService.setup).not.toHaveBeenCalled();
  expect(fieldReviewService.detail).not.toHaveBeenCalled();
  expect(screen.getByRole('note', { name: 'Rate per sq ft review note' })).toHaveTextContent('Check ratePerSqft.');
  expect(screen.getByRole('note', { name: 'Contact Number review note' })).toHaveTextContent('Check contactNumber.');
  expect(screen.getByRole('note', { name: 'Availability review note' })).toHaveTextContent('Check availabilityReview.');
  expect(screen.getByRole('note', { name: 'Availability last reviewed review note' })).toHaveTextContent('Check availabilityReview.');
  expect(screen.queryByRole('note', { name: 'City review note' })).not.toBeInTheDocument();
});

const bundledWarehouse = (keys = ['ratePerSqft']) => ({ ...warehouse,
  _fieldReviewAccessKey: fieldReviewAccessKey(user), fieldReviewSummary: summary(keys)[0] });

it.each([[['ratePerSqft']], [[]]])('renders bundled fields immediately without a second request: %j', keys => {
  openView(bundledWarehouse(keys));
  expect(fieldReviewService.summaries).not.toHaveBeenCalled();
  expect(screen.queryByText('Loading review flags and notes…')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.fr-field-note')).toHaveLength(keys.length);
});

it('renders a reviewer’s note as plain text, preserving line breaks', () => {
  const row = bundledWarehouse();
  const comment = 'Confirm the rent.\n<script>alert("note")</script>';
  row.fieldReviewSummary.activeFields[0].comment = comment;
  openView(row);
  const note = screen.getByRole('note', { name: 'Rate per sq ft review note' });
  expect(note.querySelector('p').textContent).toBe(comment);
  expect(note.querySelector('script')).toBeNull();
});

it('shows an animated loading status and keeps the field’s note visible during refresh', async () => {
  let finish;
  fieldReviewService.summaries.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  openView(bundledWarehouse());
  act(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
  const loading = screen.getByText('Refreshing review flags and notes…').closest('[role="status"]');
  expect(loading.querySelector('.ant-spin-spinning')).not.toBeNull();
  expect(screen.getByRole('note', { name: 'Rate per sq ft review note' })).toBeInTheDocument();
  await act(async () => finish([]));
  expect(screen.queryByRole('note', { name: 'Rate per sq ft review note' })).not.toBeInTheDocument();
  expect(screen.queryByText('Refreshing review flags and notes…')).not.toBeInTheDocument();
});

it('shows an animated status while unbundled flags and notes are loading', async () => {
  let finish;
  fieldReviewService.summaries.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  openView();
  const loading = screen.getByText('Loading review flags and notes…').closest('[role="status"]');
  expect(loading.querySelector('.ant-spin-spinning')).not.toBeNull();
  await act(async () => finish(summary(['ratePerSqft'])));
  expect(screen.queryByText('Loading review flags and notes…')).not.toBeInTheDocument();
  expect(screen.getByRole('note', { name: 'Rate per sq ft review note' })).toBeInTheDocument();
});

it.each([
  { ...user, email: 'another@wareongo.com' },
  { ...user, isReviewer: true },
  { ...user, capabilities: { ...user.capabilities, WAREHOUSE_VIEW_ALL: false } },
])('does not reuse bundled notes after an identity or permission change: %j', nextUser => {
  fieldReviewService.summaries.mockImplementation(() => new Promise(() => {}));
  const props = { ...initialProps, warehouse: bundledWarehouse() };
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps: props });
  expect(result.current.fields.get('ratePerSqft')).toBe('Check ratePerSqft.');
  expect(fieldReviewService.summaries).not.toHaveBeenCalled();
  rerender({ ...props, user: nextUser });
  expect(result.current.fields.size).toBe(0);
  expect(result.current.loading).toBe(true);
  expect(fieldReviewService.summaries).toHaveBeenCalledTimes(1);
});

it('replaces refreshed notes with a new bundled response without another lookup', async () => {
  fieldReviewService.summaries.mockResolvedValueOnce([]);
  const { result, rerender } = renderHook(useFieldReviewHighlights, {
    initialProps: { ...initialProps, warehouse: bundledWarehouse() },
  });
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.fields.size).toBe(0));
  rerender({ ...initialProps, warehouse: bundledWarehouse(['numberOfDocks']) });
  expect(result.current.fields.get('numberOfDocks')).toBe('Check numberOfDocks.');
  expect(fieldReviewService.summaries).toHaveBeenCalledTimes(1);
  expect(result.current.loading).toBe(false);
});

it.each([[[]], [['numberOfDocks']]])('does not restore an older bundled summary after closing and reopening: %j', async keys => {
  const props = { ...initialProps, warehouse: bundledWarehouse() };
  fieldReviewService.summaries.mockResolvedValueOnce(summary(keys));
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps: props });
  act(() => result.current.refresh());
  await waitFor(() => expect([...result.current.fields.keys()]).toEqual(keys));
  rerender({ ...props, visible: false });
  rerender(props);
  expect([...result.current.fields.keys()]).toEqual(keys);
  expect(result.current.loading).toBe(false);
  expect(fieldReviewService.summaries).toHaveBeenCalledTimes(1);
});

it('does not restore bundled notes after a forbidden refresh when the same modal reopens', async () => {
  const props = { ...initialProps, warehouse: bundledWarehouse() };
  fieldReviewService.summaries.mockRejectedValueOnce({ response: { status: 403 } });
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps: props });
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.fields.size).toBe(0);
  rerender({ ...props, visible: false });
  rerender(props);
  expect(result.current.fields.size).toBe(0);
  expect(result.current.error).toBe(true);
});

it('resumes an interrupted refresh on reopening instead of treating the old bundle as current', async () => {
  let finishOld, finishNew;
  fieldReviewService.summaries
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
  const props = { ...initialProps, warehouse: bundledWarehouse() };
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps: props });
  act(() => result.current.refresh());
  const signal = fieldReviewService.summaries.mock.calls[0][1];
  rerender({ ...props, visible: false });
  expect(signal.aborted).toBe(true);
  rerender(props);
  expect(result.current.loading).toBe(true);
  expect(fieldReviewService.summaries).toHaveBeenCalledTimes(2);
  await act(async () => finishNew([]));
  expect(result.current.fields.size).toBe(0);
  await act(async () => finishOld(summary(['ratePerSqft'])));
  expect(result.current.fields.size).toBe(0);
});

it('immediately removes a bundled review-management link when reviewer access is revoked', () => {
  const reviewer = { ...user, isReviewer: true };
  const row = { ...bundledWarehouse(), _fieldReviewAccessKey: fieldReviewAccessKey(reviewer),
    fieldReviewSummary: { ...summary(['ratePerSqft'])[0], canOpen: true, reviewId: 'private-review' } };
  fieldReviewService.summaries.mockImplementation(() => new Promise(() => {}));
  const tree = session => <AuthContext.Provider value={{ user: session }}><App>
    <CardView warehouses={[row]} paginated={false} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(reviewer));
  expect(screen.getByRole('link', { name: 'Flagged for review · 1 field' })).toBeInTheDocument();
  expect(fieldReviewService.summaries).not.toHaveBeenCalled();
  rerender(tree(user));
  expect(screen.queryByRole('link', { name: 'Flagged for review · 1 field' })).not.toBeInTheDocument();
  expect(fieldReviewService.summaries).toHaveBeenCalledTimes(1);
});

it('shows a retry when markers cannot load and highlights fields after recovery', async () => {
  fieldReviewService.summaries.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(summary(['ratePerSqft']));
  openView();
  fireEvent.click(await screen.findByRole('button', { name: 'Retry field flags' }));
  expect(await screen.findByLabelText('Rate per sq ft is flagged for review')).toBeInTheDocument();
  expect(screen.queryByText('Review flags could not be refreshed.')).not.toBeInTheDocument();
});

it('removes closed flags and restores reopened flags after review updates', async () => {
  fieldReviewService.summaries.mockResolvedValueOnce(summary(['ratePerSqft']))
    .mockResolvedValueOnce([]).mockResolvedValueOnce(summary(['ratePerSqft']));
  const { result } = renderHook(useFieldReviewHighlights, { initialProps });
  await waitFor(() => expect(result.current.fields.has('ratePerSqft')).toBe(true));
  act(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
  await waitFor(() => expect(result.current.fields.size).toBe(0));
  act(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
  await waitFor(() => expect(result.current.fields.has('ratePerSqft')).toBe(true));
});

it.each([
  ['warehouse', { ...initialProps, warehouseId: 4822 }],
  ['identity', { ...initialProps, user: { ...user, email: 'another@wareongo.com' } }],
  ['View scope', { ...initialProps, user: { ...user, capabilities: { ...user.capabilities, WAREHOUSE_VIEW_ALL: false } } }],
])('clears old highlights and ignores a late refresh after the %s changes', async (_name, nextProps) => {
  let finishOld;
  fieldReviewService.summaries.mockResolvedValueOnce(summary(['ratePerSqft']))
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce(summary(['numberOfDocks'], nextProps.warehouseId));
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps });
  await waitFor(() => expect(result.current.fields.has('ratePerSqft')).toBe(true));
  act(() => result.current.refresh());
  const oldSignal = fieldReviewService.summaries.mock.calls[1][1];
  rerender(nextProps);
  expect(result.current.fields.size).toBe(0);
  await waitFor(() => expect(result.current.fields.has('numberOfDocks')).toBe(true));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finishOld(summary(['ratePerSqft'])));
  expect([...result.current.fields.keys()]).toEqual(['numberOfDocks']);
});

it('fetches current flags when the same warehouse is reopened', async () => {
  let finishRefresh;
  fieldReviewService.summaries.mockResolvedValueOnce(summary(['ratePerSqft']))
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const { result, rerender } = renderHook(useFieldReviewHighlights, { initialProps });
  await waitFor(() => expect(result.current.fields.size).toBe(1));
  rerender({ ...initialProps, visible: false });
  expect(result.current.fields.size).toBe(0);
  rerender(initialProps);
  expect(result.current.fields.size).toBe(0);
  await act(async () => finishRefresh([]));
  expect(result.current.loading).toBe(false);
  expect(result.current.fields.size).toBe(0);
});

it.each([401, 403, 503])('handles a refresh failure with status %s without preserving revoked access', async status => {
  fieldReviewService.summaries.mockResolvedValueOnce(summary(['ratePerSqft']))
    .mockRejectedValueOnce({ response: { status } }).mockResolvedValueOnce([]);
  const { result } = renderHook(useFieldReviewHighlights, { initialProps });
  await waitFor(() => expect(result.current.fields.size).toBe(1));
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.fields.size).toBe(status === 503 ? 1 : 0);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(false);
  expect(result.current.fields.size).toBe(0);
});

it.each([{ ...initialProps, visible: false }, { ...initialProps, warehouseId: 'staged-warehouse-uuid' }])(
  'does not request live field flags for a hidden modal or staged row: %j', props => {
    const { result } = renderHook(useFieldReviewHighlights, { initialProps: props });
    expect(fieldReviewService.summaries).not.toHaveBeenCalled();
    expect(result.current.fields.size).toBe(0);
  }
);
