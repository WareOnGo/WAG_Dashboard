import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import AuthContext from '../../../contexts/AuthContext';
import WarehouseDetailsModal from '../../WarehouseDetailsModal';
import FieldReviewDialog from '../FieldReviewDialog';
import FieldValueInput from '../FieldValueInput';
import { toInput, formatValue } from '../values';
import CardView from '../../CardView';
import { fieldReviewService } from '../../../services/fieldReviewService';
vi.mock('../../../services/fieldReviewService', () => ({
  fieldReviewService: Object.fromEntries(['setup', 'detail', 'create', 'respond', 'decide', 'returnForChanges', 'reopen', 'reassign', 'history', 'events', 'summaries', 'reveal'].map(name => [name, vi.fn()]))
}));
vi.mock('../../../services/imageLabelService', () => ({
  imageLabelService: {
    getCached: () => ({}),
    getForWarehouse: vi.fn().mockResolvedValue({})
  }
}));
vi.mock('../../VisitNotes', () => ({
  default: () => null
}));
vi.mock('../../VoiceNotesList', () => ({
  default: () => null
}));
const field = {
  key: 'totalSpaceSqft',
  label: 'Offered Area (sq ft)',
  aliases: ['Offered Area per Floor (sq ft)'],
  section: 'Warehouse Technical Specifications',
  type: 'integerList'
};
const warehouse = {
  id: 4821,
  warehouseType: 'PEB',
  city: 'Bhiwandi',
  state: 'Maharashtra',
  address: 'Mankoli',
  contactPerson: 'Owner',
  totalSpaceSqft: [50000],
  numberOfDocks: '6',
  ratePerSqft: '22',
  uploadedBy: 'Employee One',
  WarehouseData: {},
  imageLabels: {}
};
const availabilityField = { key: 'availabilityReview', label: 'Availability & last reviewed', type: 'availabilityReview', section: 'Availability' };
const availabilityBaseline = { availability: 'Yes', availabilityLastReviewedOn: '2026-11-10' };
const people = [{
  id: 1,
  name: 'Admin',
  email: 'admin@wareongo.com'
}, {
  id: 2,
  name: 'Employee One',
  email: 'employee@wareongo.com'
}, {
  id: 3,
  name: 'Other Employee',
  email: 'other@wareongo.com'
}];
const mount = (ui, admin = false, user = {}) => render(<AuthContext.Provider value={{
  user: {
    email: admin ? 'admin@wareongo.com' : 'employee@wareongo.com',
    isAdmin: admin,
    ...user
  },
  isAuthenticated: true
}}><App>{ui}</App></AuthContext.Provider>);
function review(admin = false, patch = {}) {
  const id = crypto.randomUUID();
  return {
    id,
    warehouseId: 4821,
    warehouse,
    assigneeId: 2,
    assignee: people[1],
    createdBy: people[0].email,
    createdAt: new Date().toISOString(),
    version: 1,
    canRespond: !admin,
    canVerify: admin,
    assignees: people,
    events: [],
    cycles: [],
    flags: [{
      id: crypto.randomUUID(),
      field,
      fieldKey: field.key,
      status: 'NEEDS_RESPONSE',
      version: 0,
      currentVersion: 0,
      currentValue: [50000],
      comment: 'Confirm the usable area.',
      createdAt: new Date().toISOString(),
      ...patch
    }]
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  fieldReviewService.summaries.mockResolvedValue([]);
});

it.each([false, true])('clears a saved admin choice when Current changed on reopen (confirmation=%s)', async confirming => {
  const r = review(true, { status: 'AWAITING_ADMIN', conflict: true, currentVersion: 1,
    baselineValue: [50000], currentValue: [52000], proposedValue: [48000], resolution: 'CORRECTION',
    replacementRequired: { CURRENT: false, PROPOSED: true, BASELINE: true },
  });
  fieldReviewService.detail.mockResolvedValueOnce(r).mockResolvedValueOnce({ ...r, flags: [{ ...r.flags[0], currentValue: [60000], currentVersion: 2 }] });
  function Preview() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(value => !value)}>Toggle preview</button><FieldReviewDialog open={open} reviewId={r.id} onClose={() => setOpen(false)} /></>;
  }
  mount(<Preview />, true);
  fireEvent.click(await screen.findByRole('radio', { name: /Apply proposed/ }));
  fireEvent.change(screen.getByLabelText('Why replace the current value? *'), { target: { value: 'Reason based on the previous live value.' } });
  if (confirming) fireEvent.click(screen.getByRole('button', { name: 'Review replacement' }));
  fireEvent.click(screen.getByText('Toggle preview'));
  fireEvent.click(screen.getByText('Toggle preview'));
  await waitFor(() => expect(fieldReviewService.detail).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Apply proposed/ })).not.toBeChecked());
  expect(screen.queryByRole('dialog', { name: 'Confirm replacement of the current value' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Why replace the current value? *')).not.toBeInTheDocument();
  expect(fieldReviewService.decide).not.toHaveBeenCalled();
});

it('keeps decision text but does not resurrect a confirmation after closing the preview', async () => {
  const r = review(true, { status: 'AWAITING_ADMIN', conflict: true, currentVersion: 1,
    baselineValue: [50000], currentValue: [52000], proposedValue: [48000], resolution: 'CORRECTION',
    replacementRequired: { CURRENT: false, PROPOSED: true, BASELINE: true },
  });
  fieldReviewService.detail.mockResolvedValue(r);
  function Preview() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(value => !value)}>Toggle preview</button><FieldReviewDialog open={open} reviewId={r.id} onClose={() => setOpen(false)} /></>;
  }
  mount(<Preview />, true);
  fireEvent.click(await screen.findByRole('radio', { name: /Apply proposed/ }));
  fireEvent.change(screen.getByLabelText('Why replace the current value? *'), { target: { value: 'Owner reconfirmed this correction.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review replacement' }));
  await screen.findByRole('dialog', { name: 'Confirm replacement of the current value' });
  fireEvent.click(screen.getByText('Toggle preview'));
  fireEvent.click(screen.getByText('Toggle preview'));
  await waitFor(() => expect(fieldReviewService.detail).toHaveBeenCalledTimes(2));
  expect(await screen.findByLabelText('Why replace the current value? *')).toHaveValue('Owner reconfirmed this correction.');
  expect(screen.queryByRole('dialog', { name: 'Confirm replacement of the current value' })).not.toBeInTheDocument();
  expect(fieldReviewService.decide).not.toHaveBeenCalled();
});

it('ignores a late write from an earlier opening of the same review', async () => {
  const r = review();
  let finishResponse;
  fieldReviewService.respond.mockImplementationOnce(() => new Promise(resolve => { finishResponse = resolve; }));
  fieldReviewService.detail.mockResolvedValueOnce(r).mockResolvedValue({ ...r,
    flags: [{ ...r.flags[0], status: 'VERIFIED', version: 2, currentVersion: 1,
      currentValue: [48000], finalValue: [48000], decision: 'PROPOSED', explanation: 'Latest verified outcome.' }]
  });
  function Preview() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(value => !value)}>Toggle preview</button><FieldReviewDialog open={open} reviewId={r.id} onClose={() => setOpen(false)} /></>;
  }
  mount(<Preview />);
  fireEvent.change(await screen.findByLabelText('Proposed Offered Area (sq ft)'), { target: { value: '48000' } });
  fireEvent.change(screen.getByLabelText('Verification note *'), { target: { value: 'Owner confirmed.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  await waitFor(() => expect(fieldReviewService.respond).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('tab', { name: 'All details' })).toBeDisabled();
  fireEvent.click(screen.getByText('Toggle preview'));
  fireEvent.click(screen.getByText('Toggle preview'));
  await screen.findByText('Latest verified outcome.');
  await act(async () => finishResponse({ ...r, flags: [{ ...r.flags[0], status: 'AWAITING_ADMIN', version: 1,
    explanation: 'Older response snapshot.', baselineValue: [50000], proposedValue: [48000] }] }));
  expect(screen.getByText('Latest verified outcome.')).toBeInTheDocument();
  expect(screen.queryByText('Older response snapshot.')).not.toBeInTheDocument();
});

it.each(['respond', 'reassign'])('ignores a late conflict refresh from an earlier %s attempt', async method => {
  const r = { ...review(method === 'reassign'), assignees: people, assigneeId: 2 };
  let finishRefresh;
  fieldReviewService.detail.mockResolvedValueOnce(r)
    .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; })).mockResolvedValue(r);
  fieldReviewService[method].mockRejectedValueOnce(Object.assign(new Error('An earlier session had a conflict.'), { response: { status: 409 } }));
  function Preview() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(value => !value)}>Toggle preview</button><FieldReviewDialog open={open} reviewId={r.id} onClose={() => setOpen(false)} /></>;
  }
  mount(<Preview />, method === 'reassign');
  if (method === 'respond') {
    fireEvent.click(await screen.findByRole('button', { name: 'No change needed' }));
    fireEvent.change(screen.getByLabelText('How did you verify this? *'), { target: { value: 'Owner confirmed.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  } else {
    fireEvent.change(await screen.findByLabelText('Assigned employee'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update assignee' }));
  }
  await waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
  fireEvent.click(screen.getByText('Toggle preview'));
  fireEvent.click(screen.getByText('Toggle preview'));
  await waitFor(() => expect(fieldReviewService.detail).toHaveBeenCalledTimes(3));
  await act(async () => finishRefresh(r));
  expect(screen.queryByText('An earlier session had a conflict.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Back to queue' })).toBeEnabled();
});

it('resets activity loading and ignores earlier results after reopening the same review', async () => {
  const r = review(false, {});
  r.nextEventCursor = 'older-page';
  let finishEvents;
  fieldReviewService.events.mockImplementationOnce(() => new Promise(resolve => { finishEvents = resolve; })).mockResolvedValue({ events: [], nextEventCursor: null });
  fieldReviewService.detail.mockResolvedValueOnce(r).mockResolvedValue({ ...r, nextEventCursor: 'fresh-page' });
  function Preview() {
    const [open, setOpen] = useState(true);
    return <><button onClick={() => setOpen(value => !value)}>Toggle preview</button><FieldReviewDialog open={open} reviewId={r.id} onClose={() => setOpen(false)} /></>;
  }
  mount(<Preview />);
  fireEvent.click(await screen.findByText('Review activity and earlier responses'));
  fireEvent.click(screen.getByRole('button', { name: 'Load earlier activity' }));
  fireEvent.click(screen.getByText('Toggle preview'));
  fireEvent.click(screen.getByText('Toggle preview'));
  await waitFor(() => expect(fieldReviewService.detail).toHaveBeenCalledTimes(2));
  fireEvent.click(await screen.findByText('Review activity and earlier responses'));
  expect(screen.getByRole('button', { name: /Load earlier activity$/ })).not.toHaveClass('ant-btn-loading');
  await act(async () => finishEvents({ events: [], nextEventCursor: null }));
  fireEvent.click(screen.getByRole('button', { name: 'Load earlier activity' }));
  await waitFor(() => expect(fieldReviewService.events).toHaveBeenLastCalledWith(r.id, 'fresh-page'));
});

it.each(['response', 'permission change'])('ignores an older activity page after a newer %s', async outcome => {
  const r = { ...review(), nextEventCursor: 'old-page' };
  let finishEvents;
  fieldReviewService.events.mockImplementationOnce(() => new Promise(resolve => { finishEvents = resolve; }))
    .mockResolvedValue({ events: [], nextEventCursor: null });
  fieldReviewService.detail.mockResolvedValueOnce(r);
  if (outcome === 'response') {
    fieldReviewService.respond.mockResolvedValueOnce({ ...r, nextEventCursor: 'fresh-page',
      flags: [{ ...r.flags[0], status: 'AWAITING_ADMIN', version: 1, baselineValue: [50000], proposedValue: [50000],
        resolution: 'NO_CHANGE', explanation: 'Owner confirmed.' }] });
  } else {
    const denied = Object.assign(new Error('Review access was removed.'), { response: { status: 403 } });
    fieldReviewService.respond.mockRejectedValueOnce(denied);
    fieldReviewService.detail.mockRejectedValueOnce(denied);
  }
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  fireEvent.click(await screen.findByText('Review activity and earlier responses'));
  fireEvent.click(screen.getByRole('button', { name: 'Load earlier activity' }));
  fireEvent.click(screen.getByRole('button', { name: 'No change needed' }));
  fireEvent.change(screen.getByLabelText('How did you verify this? *'), { target: { value: 'Owner confirmed.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  await screen.findByText(outcome === 'response' ? 'Awaiting reviewer' : 'Review access was removed.');
  await act(async () => finishEvents({ events: [], nextEventCursor: null }));
  if (outcome === 'response') {
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier activity' }));
    await waitFor(() => expect(fieldReviewService.events).toHaveBeenLastCalledWith(r.id, 'fresh-page'));
  } else {
    expect(screen.getByRole('alert')).toHaveTextContent('Review access was removed.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  }
});

it('discards flagging setup and confirmation when the admin identity changes', async () => {
  fieldReviewService.setup.mockResolvedValue({ fields: [{ ...field, value: [50000] }], assignees: people,
    defaultAssigneeId: 2, uploader: 'Employee One', activeFields: [],
  });
  function Preview() {
    const [admin, setAdmin] = useState(true);
    return <AuthContext.Provider value={{ user: { email: admin ? 'admin@wareongo.com' : 'employee@wareongo.com', isAdmin: admin }, isAuthenticated: true }}><App>
      <button onClick={() => setAdmin(false)}>Change identity</button>
      <WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />
    </App></AuthContext.Provider>;
  }
  render(<Preview />);
  fireEvent.click(screen.getByRole('button', { name: 'Flag for review (beta)' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Flag Offered Area (sq ft)' }));
  fireEvent.change(screen.getByLabelText('Review comment for Offered Area (sq ft)'), { target: { value: 'Confirm area.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  await screen.findByRole('dialog', { name: 'Confirm flags for warehouse #4821' });
  fireEvent.click(screen.getByText('Change identity'));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm flags for warehouse #4821' })).not.toBeInTheDocument());
  expect(screen.queryByRole('checkbox', { name: 'Flag Offered Area (sq ft)' })).not.toBeInTheDocument();
  expect(fieldReviewService.create).not.toHaveBeenCalled();
});

it('ignores a late flagging setup from a different admin identity', async () => {
  let finishSetup;
  fieldReviewService.setup.mockImplementationOnce(() => new Promise(resolve => { finishSetup = resolve; }));
  function Preview() {
    const [email, setEmail] = useState('admin@wareongo.com');
    return <AuthContext.Provider value={{ user: { email, isAdmin: true }, isAuthenticated: true }}><App>
      <button onClick={() => setEmail('second-admin@wareongo.com')}>Change admin</button>
      <WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />
    </App></AuthContext.Provider>;
  }
  render(<Preview />);
  fireEvent.click(screen.getByRole('button', { name: 'Flag for review (beta)' }));
  await waitFor(() => expect(fieldReviewService.setup).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText('Change admin'));
  await act(async () => finishSetup({ fields: [{ ...field, value: [50000] }], assignees: people,
    defaultAssigneeId: 2, uploader: 'Employee One', activeFields: [],
  }));
  expect(screen.queryByRole('checkbox', { name: 'Flag Offered Area (sq ft)' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Flag for review (beta)' })).toBeEnabled();
});

it('hides flag creation from employees without reviewer access', () => {
  mount(<WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />);
  expect(screen.queryByRole('button', { name: 'Flag for review (beta)' })).not.toBeInTheDocument();
  expect(fieldReviewService.setup).not.toHaveBeenCalled();
});

it('discards unsent flags when reviewer permission is revoked for the same identity', async () => {
  fieldReviewService.setup.mockResolvedValue({ fields: [{ ...field, value: [50000] }], assignees: people,
    defaultAssigneeId: 2, uploader: 'Employee One', activeFields: [],
  });
  const tree = isReviewer => <AuthContext.Provider value={{ user: { email: 'reviewer@wareongo.com', isAdmin: false, isReviewer } }}><App>
    <WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(true));
  fireEvent.click(screen.getByRole('button', { name: 'Flag for review (beta)' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Flag Offered Area (sq ft)' }));
  fireEvent.change(screen.getByLabelText('Review comment for Offered Area (sq ft)'), { target: { value: 'Confirm area.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  await screen.findByRole('dialog', { name: 'Confirm flags for warehouse #4821' });
  rerender(tree(false));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirm flags for warehouse #4821' })).not.toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Flag for review (beta)' })).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Flag Offered Area (sq ft)' })).not.toBeInTheDocument();
  expect(fieldReviewService.create).not.toHaveBeenCalled();
});

it('discards reviewer controls and ignores a pending detail response after reviewer access is revoked', async () => {
  const r = review(true, { status: 'AWAITING_ADMIN', baselineValue: [50000], proposedValue: [48000] });
  let finishOld;
  fieldReviewService.detail.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce({ ...r, canVerify: false, canRespond: true });
  const tree = isReviewer => <AuthContext.Provider value={{ user: { email: 'employee@wareongo.com', isAdmin: false, isReviewer } }}><App>
    <FieldReviewDialog open reviewId={r.id} onClose={() => {}} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(true));
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  const oldSignal = fieldReviewService.detail.mock.calls[0][1];
  rerender(tree(false));
  await screen.findByText('Awaiting reviewer');
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finishOld(r));
  expect(screen.queryByRole('button', { name: 'Verify & close' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Assigned employee')).not.toBeInTheDocument();
});

it('requires reassignment before adding flags to a review whose employee lost warehouse View access', async () => {
  const id = crypto.randomUUID();
  fieldReviewService.setup.mockResolvedValue({ fields: [{ ...field, value: [50000] }],
    assignees: people.filter(person => person.id !== 2), defaultAssigneeId: 2,
    uploader: 'Employee One', activeFields: [], existingReviewId: id,
  });
  mount(<WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />, true);
  fireEvent.click(screen.getByRole('button', { name: 'Flag for review (beta)' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Flag Offered Area (sq ft)' }));
  fireEvent.change(screen.getByLabelText('Review comment for Offered Area (sq ft)'), { target: { value: 'Confirm area.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  const summary = await screen.findByRole('dialog', { name: 'Confirm flags for warehouse #4821' });
  expect(within(summary).getByRole('button', { name: 'Confirm & flag for review' })).toBeDisabled();
  expect(within(summary).getByRole('link', { name: 'Open the existing review to change its assignee.' })).toHaveAttribute('href', '/field-reviews?review=' + id);
  expect(fieldReviewService.create).not.toHaveBeenCalled();
});

it('creates one availability flag from the existing View and summarizes both values', async () => {
  fieldReviewService.setup.mockResolvedValue({
    fields: [{ ...availabilityField, value: availabilityBaseline }], assignees: people,
    defaultAssigneeId: 2, uploader: 'Employee One', activeFields: [],
  });
  fieldReviewService.create.mockResolvedValue({});
  mount(<WarehouseDetailsModal visible warehouse={{ ...warehouse, ...availabilityBaseline }} onClose={() => {}} />, true);
  expect(screen.getByText('Availability last reviewed', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('10 Nov 2026', { exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Flag for review (beta)' }));
  const checkbox = await screen.findByRole('checkbox', { name: 'Flag Availability & last reviewed' });
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByText('Availability and Last reviewed are flagged and verified together.')).toBeInTheDocument();
  fireEvent.click(checkbox);
  fireEvent.change(screen.getByLabelText('Review comment for Availability & last reviewed'), { target: { value: 'Confirm availability and when you checked it.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  const summary = await screen.findByRole('dialog', { name: 'Confirm flags for warehouse #4821' });
  expect(summary).toHaveTextContent('Availability: Yes Last reviewed: 10 Nov 2026');
  fireEvent.click(within(summary).getByRole('button', { name: 'Confirm & flag for review' }));
  await waitFor(() => expect(fieldReviewService.create).toHaveBeenCalledWith({ warehouseId: 4821, assigneeId: 2,
    fields: [{ key: 'availabilityReview', comment: 'Confirm availability and when you checked it.' }],
  }));
});

it('preserves a linked availability draft across the actual All details modal and submits both values', async () => {
  const r = review(false, { field: availabilityField, fieldKey: 'availabilityReview', currentValue: availabilityBaseline });
  r.warehouse = { ...warehouse, ...availabilityBaseline };
  const proposed = { availability: 'No', availabilityLastReviewedOn: null };
  fieldReviewService.detail.mockResolvedValue(r);
  fieldReviewService.respond.mockResolvedValue({ ...r, flags: [{ ...r.flags[0], status: 'AWAITING_ADMIN', version: 1,
    baselineValue: availabilityBaseline, proposedValue: proposed, resolution: 'CORRECTION', explanation: 'Owner says it is occupied.',
  }] });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Proposed availability'), { target: { value: 'No' } });
  fireEvent.change(screen.getByLabelText('Verification note *'), { target: { value: 'Owner says it is occupied.' } });
  fireEvent.click(screen.getByRole('tab', { name: 'All details' }));
  const view = document.querySelector('.warehouse-details-modal');
  expect(within(view).getByText('10 Nov 2026', { exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Flagged fields/ }));
  expect(screen.getByLabelText('Proposed availability')).toHaveValue('No');
  expect(screen.getByLabelText('Proposed availability last reviewed')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  await waitFor(() => expect(fieldReviewService.respond).toHaveBeenCalledWith(r.id, r.flags[0].id, {
    version: 0, baselineVersion: 0, resolution: 'CORRECTION', proposedValue: proposed, explanation: 'Owner says it is occupied.',
  }));
  expect(await screen.findByText('Awaiting reviewer')).toBeInTheDocument();
});

it('shows both availability values in each conflict choice, history and replacement confirmation', async () => {
  const proposed = { availability: 'Yes', availabilityLastReviewedOn: '2026-11-16' };
  const current = { availability: 'No', availabilityLastReviewedOn: null };
  const r = review(true, { field: availabilityField, fieldKey: 'availabilityReview', status: 'AWAITING_ADMIN',
    currentValue: current, baselineValue: availabilityBaseline, proposedValue: proposed, conflict: true, currentVersion: 2,
    resolution: 'CORRECTION', hasEditHistory: true, replacementRequired: { CURRENT: false, PROPOSED: true, BASELINE: true },
  });
  fieldReviewService.detail.mockResolvedValue(r);
  fieldReviewService.history.mockResolvedValue({ items: [{ id: 'pair-edit', oldValue: availabilityBaseline, newValue: current,
    actorEmail: 'editor@wareongo.com', createdAt: '2026-11-17T00:00:00Z', source: 'Warehouse edit',
  }] });
  fieldReviewService.decide.mockResolvedValue({ ...r, flags: [{ ...r.flags[0], status: 'VERIFIED', finalValue: proposed }] });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />, true);
  const apply = await screen.findByRole('radio', { name: /Apply proposed.*Availability: Yes.*Last reviewed: 16 Nov 2026/s });
  expect(screen.getByRole('radio', { name: /Keep current.*Availability: No.*Last reviewed: Not recorded/s })).not.toBeChecked();
  expect(screen.getByRole('radio', { name: /Restore baseline.*Availability: Yes.*Last reviewed: 10 Nov 2026/s })).not.toBeChecked();
  const history = screen.getByText('Edit history').closest('details');
  history.open = true;
  fireEvent(history, new Event('toggle'));
  await waitFor(() => expect(history).toHaveTextContent('editor@wareongo.com'));
  expect(history).toHaveTextContent('After: Availability: No Last reviewed: Not recorded');
  fireEvent.click(apply);
  fireEvent.change(screen.getByLabelText('Why replace the current value? *'), { target: { value: 'Reconfirmed availability and date with the owner.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review replacement' }));
  const confirmation = await screen.findByRole('dialog', { name: 'Confirm replacement of the current value' });
  expect(confirmation).toHaveTextContent('Availability: No Last reviewed: Not recorded');
  expect(confirmation).toHaveTextContent('Availability: Yes Last reviewed: 16 Nov 2026');
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm replacement & close' }));
  await waitFor(() => expect(fieldReviewService.decide).toHaveBeenCalledWith(r.id, r.flags[0].id, {
    version: 0, currentVersion: 2, choice: 'PROPOSED', reason: 'Reconfirmed availability and date with the owner.', confirmed: true,
  }));
});

it('uses calendar handover controls without inventing an unconfirmed unit', async () => {
  const handover = { key: 'handover', label: 'Handover', type: 'handover' };
  const legacy = { handoverType: null, handoverDate: '2026-12-01', handoverLeadValue: null, handoverLeadUnit: null };
  const onChange = vi.fn();
  expect(formatValue(legacy, handover)).toBe('2026-12-01');
  const { rerender } = render(<FieldValueInput field={handover} value={toInput(legacy, handover)} onChange={onChange} />);
  const date = screen.getByLabelText('Proposed handover date');
  fireEvent.focus(date);
  fireEvent.change(date, { target: { value: '02/12/2026' } });
  fireEvent.keyDown(date, { key: 'Enter', code: 'Enter' });
  fireEvent.blur(date);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ handoverType: 'FIXED', handoverDate: '2026-12-02' })));
  rerender(<FieldValueInput field={handover} value={toInput({ ...legacy, handoverType: 'VARIABLE' }, handover)} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Proposed handover lead time'), { target: { value: '3' } });
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ handoverType: 'VARIABLE', handoverLeadValue: '3', handoverLeadUnit: null }));
});

it('does not let a slow refresh undo a successful response on screen', async () => {
  const r = review();
  let finishRefresh;
  fieldReviewService.detail.mockResolvedValueOnce(r).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  fieldReviewService.respond.mockRejectedValueOnce(new Error('Connection interrupted.')).mockResolvedValueOnce({
    ...r, flags: [{ ...r.flags[0], status: 'AWAITING_ADMIN', version: 1, baselineValue: [50000], proposedValue: [50000], resolution: 'NO_CHANGE', explanation: 'Owner confirmed.' }],
  });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'No change needed' }));
  fireEvent.change(screen.getByLabelText('How did you verify this? *'), { target: { value: 'Owner confirmed.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  await screen.findByText('Connection interrupted.');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await waitFor(() => expect(finishRefresh).toBeTypeOf('function'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit for verification' }));
  await screen.findByText('Awaiting reviewer');
  await act(async () => finishRefresh(r));
  expect(screen.getByText('Awaiting reviewer')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit for verification' })).not.toBeInTheDocument();
});

it('does not request an overwrite reason when the server says the selected value is unchanged', async () => {
  const r = review(true, {
    field: { key: 'ratePerSqft', label: 'Rate per sq ft', type: 'text' }, fieldKey: 'ratePerSqft',
    status: 'AWAITING_ADMIN', version: 1, currentVersion: 2, conflict: true,
    currentValue: '24', baselineValue: '22', proposedValue: '24.0', resolution: 'CORRECTION',
    explanation: 'Owner confirmed.', replacementRequired: { CURRENT: false, PROPOSED: false, BASELINE: true },
  });
  fieldReviewService.detail.mockResolvedValue(r);
  fieldReviewService.decide.mockResolvedValue({ ...r, flags: [{ ...r.flags[0], status: 'VERIFIED', version: 2, finalValue: '24', decision: 'PROPOSED' }] });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />, true);
  fireEvent.click(await screen.findByRole('radio', { name: /Apply proposed/ }));
  expect(screen.queryByLabelText('Why replace the current value? *')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close with selected value' }));
  await waitFor(() => expect(fieldReviewService.decide).toHaveBeenCalledWith(r.id, r.flags[0].id, {
    version: 1, currentVersion: 2, choice: 'PROPOSED',
  }));
});
it.each(['admin', 'reviewer'])('%s flags fields in the existing View and keeps the chosen assignee on Back', async role => {
  fieldReviewService.setup.mockResolvedValue({
    fields: [{
      ...field,
      value: [50000]
    }],
    assignees: people,
    defaultAssigneeId: 2,
    uploader: 'Employee One',
    activeFields: []
  });
  fieldReviewService.create.mockResolvedValue({});
  mount(<WarehouseDetailsModal visible warehouse={warehouse} onClose={() => {}} />, role === 'admin', {
    email: role + '@wareongo.com', isReviewer: true
  });
  expect(document.querySelector('.warehouse-details-modal')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {
    name: 'Flag for review (beta)'
  }));
  fireEvent.click(await screen.findByRole('checkbox', {
    name: 'Flag Offered Area (sq ft)'
  }));
  const comment = screen.getByRole('textbox', {
    name: 'Review comment for Offered Area (sq ft)'
  });
  fireEvent.change(comment, {
    target: {
      value: 'Confirm the usable area.'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Review flags'
  }));
  const select = await screen.findByLabelText('Assign review to');
  expect(select).toHaveValue('2');
  fireEvent.change(select, {
    target: {
      value: '3'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Back to fields'
  }));
  fireEvent.click(screen.getByRole('button', {
    name: 'Review flags'
  }));
  expect(screen.getByLabelText('Assign review to')).toHaveValue('3');
  expect(fieldReviewService.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {
    name: 'Confirm & flag for review'
  }));
  await waitFor(() => expect(fieldReviewService.create).toHaveBeenCalledWith({
    warehouseId: 4821,
    assigneeId: 3,
    fields: [{
      key: field.key,
      comment: 'Confirm the usable area.'
    }]
  }));
});
it('employee has direct responses, and the real All details view preserves drafts', async () => {
  const r = review();
  fieldReviewService.detail.mockResolvedValue(r);
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  const input = await screen.findByLabelText('Proposed Offered Area (sq ft)');
  expect(screen.queryByRole('button', {
    name: /^(accept|approve|reject)/i
  })).not.toBeInTheDocument();
  fireEvent.change(input, {
    target: {
      value: '48000'
    }
  });
  fireEvent.change(screen.getByLabelText('Verification note *'), {
    target: {
      value: 'Checked with the owner.'
    }
  });
  const body = document.querySelector('.fr-modal .responsive-modal__body');
  body.scrollTop = 143;
  fireEvent.click(screen.getByRole('tab', {
    name: 'All details'
  }));
  expect(document.querySelector('.warehouse-details-modal')).toBeInTheDocument();
  expect(screen.getByText('Owner Details')).toBeInTheDocument();
  expect(screen.getByText('50000')).toBeInTheDocument();
  expect(screen.queryByRole('button', {
    name: 'Flag for review (beta)'
  })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', {
    name: /Flagged fields/
  }));
  expect(screen.getByLabelText('Proposed Offered Area (sq ft)')).toHaveValue('48000');
  expect(screen.getByLabelText('Verification note *')).toHaveValue('Checked with the owner.');
  expect(document.querySelector('.fr-modal .responsive-modal__body').scrollTop).toBe(143);
  expect(fieldReviewService.respond).not.toHaveBeenCalled();
});
it('requires a no-change explanation and stages the response', async () => {
  const r = review();
  fieldReviewService.detail.mockResolvedValue(r);
  fieldReviewService.respond.mockResolvedValue({
    ...r,
    flags: [{
      ...r.flags[0],
      status: 'AWAITING_ADMIN',
      version: 1,
      baselineValue: [50000],
      proposedValue: [50000],
      resolution: 'NO_CHANGE',
      explanation: 'Inspected the layout.'
    }]
  });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', {
    name: 'No change needed'
  }));
  fireEvent.click(screen.getByRole('button', {
    name: 'Submit for verification'
  }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Explain what you checked');
  expect(fieldReviewService.respond).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('How did you verify this? *'), {
    target: {
      value: 'Inspected the layout.'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Submit for verification'
  }));
  await waitFor(() => expect(fieldReviewService.respond).toHaveBeenCalledWith(r.id, r.flags[0].id, {
    version: 0,
    baselineVersion: 0,
    resolution: 'NO_CHANGE',
    explanation: 'Inspected the layout.'
  }));
  expect(await screen.findByText('Awaiting reviewer')).toBeInTheDocument();
  expect(screen.queryByRole('button', {
    name: 'Submit for verification'
  })).not.toBeInTheDocument();
});
it('keeps a failed draft but requires reconfirming a new live baseline', async () => {
  const r = review();
  fieldReviewService.detail.mockResolvedValueOnce(r).mockResolvedValue({
    ...r,
    flags: [{
      ...r.flags[0],
      currentValue: [52000],
      currentVersion: 1
    }]
  });
  fieldReviewService.respond.mockRejectedValue(Object.assign(new Error('Live value changed.'), {
    response: {
      status: 409
    }
  }));
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Proposed Offered Area (sq ft)'), {
    target: {
      value: '48000'
    }
  });
  fireEvent.change(screen.getByLabelText('Verification note *'), {
    target: {
      value: 'Owner confirmed.'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Submit for verification'
  }));
  const rebase = await screen.findByRole('button', {
    name: 'Use the latest value as my baseline'
  });
  expect(screen.getByLabelText('Proposed Offered Area (sq ft)')).toHaveValue('48000');
  expect(screen.getByRole('button', {
    name: 'Submit for verification'
  })).toBeDisabled();
  fireEvent.click(rebase);
  expect(screen.getByRole('button', {
    name: 'Submit for verification'
  })).toBeEnabled();
});
it.each(['admin', 'reviewer'])('%s compares all three values and must explain and confirm a replacement', async role => {
  const r = review(true, {
    status: 'AWAITING_ADMIN',
    version: 1,
    baselineVersion: 0,
    currentVersion: 1,
    baselineValue: [50000],
    proposedValue: [48000],
    currentValue: [52000],
    resolution: 'CORRECTION',
    explanation: 'Checked with owner.',
    conflict: true,
    hasEditHistory: true
  });
  fieldReviewService.detail.mockResolvedValue(r);
  fieldReviewService.history.mockResolvedValue({
    items: [{
      id: 'edit',
      oldValue: [50000],
      newValue: [52000],
      actorEmail: 'editor@wareongo.com',
      createdAt: new Date().toISOString(),
      source: 'Warehouse edit'
    }]
  });
  fieldReviewService.decide.mockResolvedValue({
    ...r,
    flags: [{
      ...r.flags[0],
      status: 'VERIFIED',
      version: 2,
      decision: 'PROPOSED',
      finalValue: [48000],
      currentValue: [48000]
    }]
  });
  mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />, role === 'admin', {
    email: role + '@wareongo.com', isReviewer: true
  });
  const proposal = await screen.findByRole('radio', {
    name: /Apply proposed/
  });
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  screen.getAllByRole('radio').forEach(radio => expect(radio).not.toBeChecked());
  expect(screen.getByText('Baseline', {
    exact: true
  })).toBeInTheDocument();
  fireEvent.click(screen.getByText('Edit history'));
  expect(await screen.findByText(/editor@wareongo.com/)).toBeInTheDocument();
  fireEvent.click(proposal);
  fireEvent.click(screen.getByRole('button', {
    name: 'Review replacement'
  }));
  expect(fieldReviewService.decide).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Why replace the current value? *'), {
    target: {
      value: 'Owner reconfirmed usable space.'
    }
  });
  fireEvent.click(screen.getByRole('button', {
    name: 'Review replacement'
  }));
  const confirm = await screen.findByRole('button', {
    name: 'Confirm replacement & close'
  });
  expect(fieldReviewService.decide).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() => expect(fieldReviewService.decide).toHaveBeenCalledWith(r.id, r.flags[0].id, {
    version: 1,
    currentVersion: 1,
    choice: 'PROPOSED',
    reason: 'Owner reconfirmed usable space.',
    confirmed: true
  }));
});
it('shows active markers, preserves them on failure and clears them after success', async () => {
  const id = crypto.randomUUID();
  fieldReviewService.summaries.mockResolvedValueOnce([{
    warehouseId: 4821,
    activeCount: 2,
    canOpen: true,
    reviewId: id
  }]);
  mount(<CardView warehouses={[warehouse]} paginated={false} />);
  const link = await screen.findByRole('link', {
    name: 'Flagged for review · 2 fields'
  });
  expect(link).toHaveAttribute('href', '/field-reviews?review=' + id);
  fieldReviewService.summaries.mockRejectedValueOnce(new Error('Offline'));
  act(() => window.dispatchEvent(new Event('warehouse-field-review-updated')));
  const retry = await screen.findByRole('button', {
    name: 'Retry review status'
  });
  expect(link).toBeInTheDocument();
  fieldReviewService.summaries.mockResolvedValueOnce([]);
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByRole('link', {
    name: /Flagged for review/
  })).not.toBeInTheDocument());
  expect(within(document.querySelector('.simple-warehouse-card')).getByRole('button', {
    name: /View$/
  })).toBeInTheDocument();
});

it.each([false, true])('refreshes dashboard review links when reviewer access changes from %s', async initialReviewer => {
  const id = crypto.randomUUID();
  let finishRefresh;
  fieldReviewService.summaries.mockReset().mockResolvedValueOnce([{
    warehouseId: 4821, activeCount: 1, canOpen: initialReviewer, reviewId: initialReviewer ? id : null,
  }]).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
  const rows = [warehouse];
  const tree = isReviewer => <AuthContext.Provider value={{ user: { email: 'reviewer@wareongo.com', isAdmin: false, isReviewer } }}><App>
    <CardView warehouses={rows} paginated={false} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(initialReviewer));
  await screen.findByText('Flagged for review · 1 field');
  rerender(tree(!initialReviewer));
  expect(screen.queryByRole('link', { name: 'Flagged for review · 1 field' })).not.toBeInTheDocument();
  await waitFor(() => expect(fieldReviewService.summaries).toHaveBeenCalledTimes(2));
  await act(async () => finishRefresh([{
    warehouseId: 4821, activeCount: 1, canOpen: !initialReviewer, reviewId: initialReviewer ? null : id,
  }]));
  expect(screen.getByText('Flagged for review · 1 field')).toBeInTheDocument();
  const link = screen.queryByRole('link', { name: 'Flagged for review · 1 field' });
  if (initialReviewer) expect(link).not.toBeInTheDocument();
  else expect(link).toHaveAttribute('href', '/field-reviews?review=' + id);
});

it('ignores a late dashboard summary from the previous reviewer role', async () => {
  const id = crypto.randomUUID();
  let finishOld;
  fieldReviewService.summaries.mockReset()
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce([{ warehouseId: 4821, activeCount: 1, canOpen: false, reviewId: null }]);
  const rows = [warehouse];
  const tree = isReviewer => <AuthContext.Provider value={{ user: { email: 'reviewer@wareongo.com', isAdmin: false, isReviewer } }}><App>
    <CardView warehouses={rows} paginated={false} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(true));
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  const oldSignal = fieldReviewService.summaries.mock.calls[0][1];
  rerender(tree(false));
  await screen.findByText('Flagged for review · 1 field');
  expect(oldSignal.aborted).toBe(true);
  await act(async () => finishOld([{ warehouseId: 4821, activeCount: 1, canOpen: true, reviewId: id }]));
  expect(screen.queryByRole('link', { name: 'Flagged for review · 1 field' })).not.toBeInTheDocument();
});

it('does not retain dashboard review links from an old role when the new summary fails', async () => {
  fieldReviewService.summaries.mockReset().mockResolvedValueOnce([{
    warehouseId: 4821, activeCount: 1, canOpen: true, reviewId: crypto.randomUUID(),
  }]).mockRejectedValueOnce(new Error('Review access was removed.'));
  const rows = [warehouse];
  const tree = isReviewer => <AuthContext.Provider value={{ user: { email: 'reviewer@wareongo.com', isAdmin: false, isReviewer } }}><App>
    <CardView warehouses={rows} paginated={false} />
  </App></AuthContext.Provider>;
  const { rerender } = render(tree(true));
  await screen.findByRole('link', { name: 'Flagged for review · 1 field' });
  rerender(tree(false));
  await screen.findByRole('button', { name: 'Retry review status' });
  expect(screen.queryByText('Flagged for review · 1 field')).not.toBeInTheDocument();
});

it.each([[false, 'Verified · no change needed'], [true, 'Applied verified baseline']])(
  'distinguishes a verified no-change response from replacing a newer value: changed=%s', async (changed, label) => {
    const r = review(true, { status: 'VERIFIED', resolution: 'NO_CHANGE', decision: 'PROPOSED', finalValue: [50000] });
    r.events = [{ id: crypto.randomUUID(), flagId: r.flags[0].id, action: 'VERIFIED', actorEmail: 'admin@wareongo.com', createdAt: new Date().toISOString(), payload: { choice: 'PROPOSED', changed } }];
    fieldReviewService.detail.mockResolvedValue(r);
    mount(<FieldReviewDialog open reviewId={r.id} onClose={() => {}} />, true);
    expect(await screen.findByText(label, { exact: true })).toBeInTheDocument();
  }
);
