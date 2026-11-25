import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import AiQaReviewDialog from '../AiQaReviewDialog';
import { aiQaService } from '../../../services/aiQaService';
vi.mock('../../../services/aiQaService', () => ({ aiQaService: { detail: vi.fn(), mutate: vi.fn() } }));
vi.mock('../../WarehouseDetailsModal', () => ({
  default: ({ statusBanner, fieldReviewSelection: selection }) => (
    <section>
      {statusBanner}
      {selection.fields.map((field) => (
        <div key={field.key}>
          <input
            type="checkbox"
            aria-label={'Flag ' + field.label}
            checked={selection.selected.includes(field.key)}
            disabled={selection.disabled}
            onChange={(event) => selection.toggle(field.key, event.target.checked)}
          />
          <textarea
            aria-label={'Review comment for ' + field.label}
            disabled={selection.disabled}
            value={selection.comments[field.key] || ''}
            onChange={(event) => selection.comment(field.key, event.target.value)}
          />
        </div>
      ))}
    </section>
  )
}));
const field = { key: 'warehouseData.powerKva', label: 'Power', type: 'text' };
const config = { registry: [field], handoff_mode: 'FIELD_REVIEW' };
const row = () => ({
  warehouse_id: 1,
  fields: { [field.key]: '5' },
  stage: 'AI_REVIEW',
  version: 0,
  execution_current: true,
  candidates: [
    {
      field_key: field.key,
      source: 'MACHINE',
      decision: 'PENDING',
      admin_note: '',
      suggested_note: 'Confirm the power unit.',
      findings: []
    }
  ],
  checks: [],
  events: [],
  coverage: { ai_status: 'COMPLETED', not_evaluated: 0, deferred: [] },
  assignment: {
    assignees: [{ id: 2, name: 'Employee', email: 'employee@example.invalid' }],
    defaultAssigneeId: 2,
    activeFields: []
  }
});
const mount = (props = {}) =>
  render(
    <App>
      <AiQaReviewDialog
        runId="run"
        whid={1}
        config={config}
        warehouse={{ id: 1 }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        {...props}
      />
    </App>
  );
beforeEach(() => {
  vi.clearAllMocks();
  aiQaService.detail.mockResolvedValue(row());
});
it('uses the real roster and normal confirmation, then links to the created employee review', async () => {
  const saved = { ...row(), version: 1, stage: 'ASSIGNED', handoff: { review_id: 'created-review' } };
  aiQaService.mutate.mockResolvedValue(saved);
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Review flags' }));
  const confirmation = await screen.findByRole('dialog');
  expect(within(confirmation).getByLabelText('Assign review to')).toHaveValue('2');
  expect(within(confirmation).getByText('AI')).toBeInTheDocument();
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm & flag for review' }));
  await waitFor(() =>
    expect(aiQaService.mutate).toHaveBeenCalledWith(
      'run',
      1,
      'confirm',
      expect.objectContaining({
        assignee_id: 2,
        expected_version: 0,
        review: expect.objectContaining({ machine: [expect.objectContaining({ decision: 'APPROVED' })] })
      })
    )
  );
  expect(await screen.findByRole('link', { name: 'Open employee review' })).toHaveAttribute(
    'href',
    '/field-reviews?review=created-review'
  );
});
it.each(['unavailable', 'policy changed'])('prevents assignment when the source is %s', async (condition) => {
  aiQaService.detail.mockResolvedValue({ ...row(), execution_current: condition !== 'policy changed' });
  mount({ sourceUnavailable: condition === 'unavailable' });
  await screen.findByLabelText('Flag Power');
  const reviewButton = screen.queryByRole('button', { name: 'Review flags' });
  if (reviewButton) expect(reviewButton).toBeDisabled();
  expect(aiQaService.mutate).not.toHaveBeenCalled();
});
it('a source-conflict response preserves the draft and refreshes the queue without reporting assignment success', async () => {
  aiQaService.mutate.mockRejectedValue(
    Object.assign(new Error('Warehouse evidence changed.'), { status: 409, code: 'QA_SOURCE_CHANGED' })
  );
  const onSaved = vi.fn();
  mount({ onSaved });
  fireEvent.change(await screen.findByLabelText('Review comment for Power'), {
    target: { value: 'Keep this admin note.' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm & flag for review' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(screen.getByLabelText('Review comment for Power')).toHaveValue('Keep this admin note.');
  expect(screen.queryByRole('link', { name: 'Open employee review' })).not.toBeInTheDocument();
});

it('reloading after a concurrent reassignment uses the new locked assignee', async () => {
  const initial = row();
  initial.assignment.existingReviewId = 'manual-review';
  const refreshed = {
    ...row(),
    assignment: { ...initial.assignment, assignees: [{ id: 3, name: 'New employee' }], defaultAssigneeId: 3 }
  };
  aiQaService.detail.mockResolvedValueOnce(initial).mockResolvedValue(refreshed);
  aiQaService.mutate.mockRejectedValue(
    Object.assign(new Error('Keep the current assignee.'), { status: 409 })
  );
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Review flags' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm & flag for review' }));
  await screen.findAllByText('Keep the current assignee.');
  fireEvent.click(screen.getAllByRole('button', { name: 'Reload review' })[0]);
  fireEvent.click(await screen.findByRole('button', { name: 'Reload and discard draft' }));
  await waitFor(() => expect(screen.queryByText('Reload this warehouse review?')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Review flags' }));
  const confirmation = await screen.findByRole('dialog');
  expect(within(confirmation).getByLabelText('Assign review to')).toHaveValue('3');
  expect(within(confirmation).getByLabelText('Assign review to')).toBeDisabled();
});
