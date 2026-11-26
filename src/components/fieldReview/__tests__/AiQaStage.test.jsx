import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { App } from 'antd';
import AiQaStage from '../AiQaStage';
import { aiQaService } from '../../../services/aiQaService';
import { warehouseService } from '../../../services/warehouseService';
vi.mock('../../../services/aiQaService', () => ({
  aiQaService: {
    config: vi.fn(),
    runs: vi.fn(),
    list: vi.fn(),
    reviewers: vi.fn(),
    summary: vi.fn(),
    processRun: vi.fn(),
    createRun: vi.fn()
  }
}));
vi.mock('../../../services/warehouseService', () => ({ warehouseService: { getByIds: vi.fn() } }));
vi.mock('../../CardView', () => ({
  default: ({ warehouses, getCardProps }) => (
    <div>
      {warehouses.map((warehouse) => {
        const props = getCardProps(warehouse);
        return (
          <article key={warehouse.id}>
            <h3>Warehouse {warehouse.id}</h3>
            {props.statusContent}
            {props.metaInfo}
            {props.actions}
          </article>
        );
      })}
    </div>
  )
}));
vi.mock('../AiQaReviewDialog', () => ({
  default: ({ whid, sourceUnavailable }) => (
    <div role="dialog">
      Warehouse {whid}: {sourceUnavailable ? 'saved only' : 'source available'}
    </div>
  )
}));
const onCountChange = vi.fn();
function StageHarness() {
  const [reviewerEmail, setReviewerEmail] = useState('');
  return <App><AiQaStage onCountChange={onCountChange} reviewerEmail={reviewerEmail} onReviewerChange={setReviewerEmail} /></App>;
}
const renderStage = () => render(<StageHarness />);
beforeEach(() => {
  Object.values(aiQaService).forEach(mock => mock.mockReset());
  warehouseService.getByIds.mockReset();
  onCountChange.mockReset();
  aiQaService.config.mockResolvedValue({ registry: [], handoff_mode: 'FIELD_REVIEW' });
  aiQaService.runs.mockResolvedValue([{ id: 'inbox', warehouse_count: 2 }]);
  aiQaService.reviewers.mockResolvedValue([{ email: 'meera@wareongo.com', name: 'Meera Shah' }]);
  aiQaService.list.mockResolvedValue({
    warehouses: [1, 2].map((id) => ({
      warehouse_id: id,
      run_id: 'run',
      fields: {},
      stage: 'AI_REVIEW',
      candidates: [],
      checks: []
    })),
    total: 2,
    flagged_columns: 0,
    metrics: {}
  });
  aiQaService.summary.mockResolvedValue({ pending_warehouses: 2 });
  warehouseService.getByIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);
});

it('filters AI pages and counts by admin, preserves the stage, and clears search and admin together', async () => {
  const initial = await aiQaService.list();
  aiQaService.list.mockClear().mockResolvedValue({ ...initial, total: 41 });
  renderStage();
  await screen.findByRole('heading', { name: 'Warehouse 1' });
  fireEvent.click(screen.getByTitle('2'));
  await waitFor(() => expect(aiQaService.list).toHaveBeenLastCalledWith('inbox', expect.any(AbortSignal), expect.objectContaining({ page: 2 })));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by admin or reviewer' }));
  fireEvent.click(await screen.findByText('Meera Shah (meera@wareongo.com)'));
  await waitFor(() => expect(aiQaService.list).toHaveBeenLastCalledWith('inbox', expect.any(AbortSignal), {
    page: 1, limit: 20, stage: 'AI_REVIEW', search: '', reviewerEmail: 'meera@wareongo.com'
  }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search AI flags' }), { target: { value: 'Bhiwandi' } });
  await waitFor(() => expect(aiQaService.list).toHaveBeenLastCalledWith('inbox', expect.any(AbortSignal), expect.objectContaining({ search: 'Bhiwandi' })));
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'AI review status' }));
  fireEvent.click(await screen.findByText('Dismissed', { selector: '.ant-select-item-option-content' }));
  await waitFor(() => expect(aiQaService.list).toHaveBeenLastCalledWith('inbox', expect.any(AbortSignal), expect.objectContaining({ stage: 'DISMISSED', reviewerEmail: 'meera@wareongo.com' })));
  expect(screen.getByText('Dismissed by', { exact: true })).toBeInTheDocument();
  expect(aiQaService.reviewers).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(aiQaService.summary).toHaveBeenLastCalledWith(expect.any(AbortSignal), { reviewerEmail: 'meera@wareongo.com' }));
  expect(screen.getByText('2 active filters')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear All Filters' }));
  await waitFor(() => expect(aiQaService.list).toHaveBeenLastCalledWith('inbox', expect.any(AbortSignal), { page: 1, limit: 20, stage: 'DISMISSED', search: '' }));
  expect(screen.getByRole('textbox', { name: 'Search AI flags' })).toHaveValue('');
  expect(screen.queryByLabelText('Applied filters')).not.toBeInTheDocument();
});

it('reopening the page resumes durable pending work without creating another batch', async () => {
  aiQaService.runs
    .mockResolvedValueOnce([{ id: 'inbox' }, { id: 'saved-run', status: 'RUNNING' }])
    .mockResolvedValue([{ id: 'inbox' }, { id: 'saved-run', status: 'COMPLETED' }]);
  aiQaService.processRun.mockResolvedValue({ id: 'saved-run', status: 'COMPLETED' });
  renderStage();
  await waitFor(() =>
    expect(aiQaService.processRun).toHaveBeenCalledWith('saved-run', expect.any(AbortSignal))
  );
  await screen.findByRole('heading', { name: 'Warehouse 1' });
  await waitFor(() => expect(screen.queryByText('Running warehouse QA…')).not.toBeInTheDocument());
  expect(aiQaService.createRun).not.toHaveBeenCalled();
});

it('a lost processing response can resume the same run without re-enqueuing warehouse IDs', async () => {
  aiQaService.runs
    .mockResolvedValueOnce([{ id: 'inbox' }, { id: 'saved-run', status: 'RUNNING' }])
    .mockResolvedValue([{ id: 'inbox' }, { id: 'saved-run', status: 'COMPLETED' }]);
  aiQaService.processRun
    .mockRejectedValueOnce(new Error('Network interrupted'))
    .mockResolvedValue({ id: 'saved-run', status: 'COMPLETED' });
  renderStage();
  await waitFor(() => expect(aiQaService.processRun).toHaveBeenCalledTimes(1));
  fireEvent.click(await screen.findByRole('button', { name: 'Resume QA' }));
  await waitFor(() => expect(aiQaService.processRun).toHaveBeenCalledTimes(2));
  expect(aiQaService.processRun.mock.calls.every(([id]) => id === 'saved-run')).toBe(true);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Resume QA' })).not.toBeInTheDocument());
  expect(aiQaService.createRun).not.toHaveBeenCalled();
});

it('an admin starts a manual batch and the page advances it through the authenticated API', async () => {
  aiQaService.createRun.mockResolvedValue({ id: 'new-run', status: 'QUEUED' });
  aiQaService.processRun.mockResolvedValue({ id: 'new-run', status: 'COMPLETED' });
  renderStage();
  await screen.findByRole('heading', { name: 'Warehouse 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Run QA' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Warehouse IDs'), { target: { value: '603, 1065' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Run QA' }));
  await waitFor(() => expect(aiQaService.createRun).toHaveBeenCalledWith([603, 1065]));
  await waitFor(() =>
    expect(aiQaService.processRun).toHaveBeenCalledWith('new-run', expect.any(AbortSignal))
  );
});

it('a duplicate WHID rejection keeps the entered IDs and shows the server explanation without starting work', async () => {
  const explanation = 'WH603 is already in the QA/review pipeline. No new batch was created.';
  aiQaService.createRun.mockRejectedValue(
    Object.assign(new Error(explanation), {
      status: 409,
      code: 'QA_WAREHOUSE_IN_PIPELINE'
    })
  );
  renderStage();
  await screen.findByRole('heading', { name: 'Warehouse 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Run QA' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Warehouse IDs'), { target: { value: '603, 1065' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Run QA' }));
  expect(await screen.findByText(explanation)).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Warehouse IDs')).toHaveValue('603, 1065');
  expect(aiQaService.createRun).toHaveBeenCalledTimes(1);
  expect(aiQaService.processRun).not.toHaveBeenCalled();
});
it('a missing source leaves other cards usable and the missing warehouse readable without assignment', async () => {
  warehouseService.getByIds.mockResolvedValue([{ id: 2, city: 'Present' }]);
  renderStage();
  expect(await screen.findByRole('heading', { name: 'Warehouse 1' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Warehouse 2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Review AI flags for WH1' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Warehouse 1: saved only');
  fireEvent.click(screen.getByRole('button', { name: 'Review AI flags for WH2' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('Warehouse 2: source available');
});
it('a temporary source outage preserves saved cards and refresh restores their current context', async () => {
  warehouseService.getByIds
    .mockRejectedValueOnce(new Error('Source offline'))
    .mockResolvedValue([{ id: 1 }, { id: 2 }]);
  renderStage();
  await screen.findByRole('heading', { name: 'Warehouse 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry source' }));
  await waitFor(() =>
    expect(screen.queryByText('Source unavailable · saved review only')).not.toBeInTheDocument()
  );
  expect(screen.getByRole('heading', { name: 'Warehouse 2' })).toBeInTheDocument();
});
it('an authorization failure does not retain source records on screen', async () => {
  warehouseService.getByIds.mockRejectedValue(Object.assign(new Error('Access removed'), { status: 403 }));
  renderStage();
  expect(await screen.findByRole('alert')).toHaveTextContent('Access removed');
  expect(screen.queryByRole('heading', { name: 'Warehouse 1' })).not.toBeInTheDocument();
});
