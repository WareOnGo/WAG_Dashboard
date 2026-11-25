import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../../../contexts/AuthContext';
import FieldReviewQueue from '../../FieldReviewQueue';
import { fieldReviewService } from '../../../services/fieldReviewService';
import { aiQaService } from '../../../services/aiQaService';

vi.mock('../../../services/fieldReviewService', () => ({ fieldReviewService: { list: vi.fn() } }));
vi.mock('../../../services/aiQaService', () => ({ aiQaService: { summary: vi.fn() } }));
vi.mock('../AiQaStage', () => ({ default: () => <section aria-label="AI flags stage">Local AI review stage</section> }));
vi.mock('../../CardView', () => ({ default: ({ warehouses }) => <div>{warehouses.map(w => <p key={w.id}>Warehouse #{w.id}</p>)}</div> }));
vi.mock('../FieldReviewDialog', () => ({ default: () => null }));
const result = id => ({ data: [{ id: crypto.randomUUID(), warehouseId: id, warehouse: {}, flags: [], activeCount: 1 }], counts: {}, pagination: { total: 1, totalPages: 1 } });
const tree = (user, entries = ['/field-reviews']) => <MemoryRouter initialEntries={entries}><AuthContext.Provider value={{ user }}><App><FieldReviewQueue /></App></AuthContext.Provider></MemoryRouter>;
beforeEach(() => { fieldReviewService.list.mockReset(); aiQaService.summary.mockReset().mockResolvedValue({ pending_warehouses: 10 }); });

it('adds AI flags inside the existing stages for admins and keeps its requests out of the manual queue', async () => {
  fieldReviewService.list.mockResolvedValue(result(4821));
  render(tree({ email: 'admin@wareongo.com', isAdmin: true }));
  await screen.findByText('Warehouse #4821');
  fireEvent.click(await screen.findByText('AI flags (10)'));
  expect(screen.getByRole('region', { name: 'AI flags stage' })).toBeInTheDocument();
  expect(screen.queryByText('Warehouse #4821')).not.toBeInTheDocument();
  expect(fieldReviewService.list.mock.calls.every(([query]) => query.view !== 'ai')).toBe(true);
  fireEvent.click(screen.getByText(/Awaiting employee/));
  await screen.findByText('Warehouse #4821');
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'employee' }), expect.any(AbortSignal)));
});

it('opens the AI stage directly and clears it when an admin becomes an ordinary reviewer', async () => {
  fieldReviewService.list.mockResolvedValue(result(4822));
  const user = { email: 'admin@wareongo.com', isAdmin: true, isReviewer: true };
  const { rerender } = render(tree(user, ['/field-reviews?stage=ai']));
  expect(await screen.findByRole('region', { name: 'AI flags stage' })).toBeInTheDocument();
  expect(fieldReviewService.list).not.toHaveBeenCalled();
  const before = aiQaService.summary.mock.calls.length;
  rerender(tree({ ...user, isAdmin: false }, ['/field-reviews?stage=ai']));
  await screen.findByText('Warehouse #4822');
  expect(screen.queryByRole('region', { name: 'AI flags stage' })).not.toBeInTheDocument();
  expect(screen.queryByText(/AI flags/)).not.toBeInTheDocument();
  expect(aiQaService.summary.mock.calls.length).toBe(before);
});

it.each([{ email: 'reviewer@wareongo.com', isReviewer: true }, { email: 'employee@wareongo.com' }])('never fetches or displays the AI stage for $email', async user => {
  fieldReviewService.list.mockResolvedValue(result(4821));
  render(tree(user, ['/field-reviews?stage=ai']));
  await screen.findByText('Warehouse #4821');
  expect(aiQaService.summary).not.toHaveBeenCalled();
  expect(screen.queryByText(/AI flags/)).not.toBeInTheDocument();
});

it('filters the server queue, resets pagination and preserves the selected review tab when filters clear', async () => {
  fieldReviewService.list.mockResolvedValue({ ...result(4821), pagination: { total: 41, totalPages: 3 },
    filterOptions: [{ city: 'Bhiwandi', state: 'Maharashtra', warehouseType: 'PEB' }]
  });
  render(tree({ email: 'employee@wareongo.com' }));
  await screen.findByText('Warehouse #4821');
  fireEvent.click(screen.getByTitle('2'));
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2, limit: 20 }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  fireEvent.change(screen.getByLabelText('City', { exact: true }), { target: { value: 'Bhiwandi' } });
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, city: 'Bhiwandi' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByText(/Previously flagged/));
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, view: 'previous', city: 'Bhiwandi' }), expect.any(AbortSignal)));
  fireEvent.click(within(screen.getByLabelText('Applied filters')).getByRole('button', { name: 'Clear All Filters' }));
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenLastCalledWith(
    { view: 'previous', page: 1, limit: 20 }, expect.any(AbortSignal)));
  expect(screen.queryByLabelText('Applied filters')).not.toBeInTheDocument();
});

it('discards filter suggestions and pending responses when warehouse access narrows', async () => {
  const user = { email: 'employee@wareongo.com', capabilities: { DASHBOARD: true, WAREHOUSE_VIEW_OWN: true, WAREHOUSE_VIEW_ALL: true } };
  let finishOld;
  fieldReviewService.list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce({ ...result(4822), filterOptions: [] });
  const { rerender } = render(tree(user));
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  const previousSignal = fieldReviewService.list.mock.calls[0][1];
  rerender(tree({ ...user, capabilities: { ...user.capabilities, WAREHOUSE_VIEW_ALL: false } }));
  await screen.findByText('Warehouse #4822');
  expect(previousSignal.aborted).toBe(true);
  await act(async () => finishOld({ ...result(4821), filterOptions: [{ city: 'Restricted city', state: 'Restricted state' }] }));
  expect(screen.queryByText('Warehouse #4821')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Filters', exact: true }));
  fireEvent.focus(screen.getByLabelText('City', { exact: true }));
  expect(screen.queryByText('Restricted city')).not.toBeInTheDocument();
});

it('gives reviewers the management queue and resets it when reviewer access is revoked', async () => {
  let finishOld;
  fieldReviewService.list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValueOnce(result(4822));
  const user = { email: 'reviewer@wareongo.com', isAdmin: false, isReviewer: true };
  const { rerender } = render(tree(user));
  expect(screen.getByRole('heading', { name: 'Flag Review Queue' })).toBeInTheDocument();
  expect(screen.getByText('Reviewer view')).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Filter by assignee' })).toBeInTheDocument();
  await waitFor(() => expect(fieldReviewService.list).toHaveBeenCalledWith(
    expect.objectContaining({ view: 'verify' }), expect.any(AbortSignal)));
  const oldSignal = fieldReviewService.list.mock.calls[0][1];
  rerender(tree({ ...user, isReviewer: false }));
  await screen.findByText('Warehouse #4822');
  expect(oldSignal.aborted).toBe(true);
  expect(fieldReviewService.list).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'current' }), expect.any(AbortSignal));
  await act(async () => finishOld(result(4821)));
  expect(screen.queryByText('Warehouse #4821')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Flag Review Queue' })).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Filter by assignee' })).not.toBeInTheDocument();
});

it('clears the previous identity and ignores its late queue response', async () => {
  let finishOld, finishNew;
  fieldReviewService.list.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve; }));
  const { rerender } = render(tree({ email: 'admin@wareongo.com', isAdmin: true }));
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  rerender(tree({ email: 'employee@wareongo.com', isAdmin: false }));
  await waitFor(() => expect(finishNew).toBeTypeOf('function'));
  expect(fieldReviewService.list).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'current' }), expect.any(AbortSignal));
  await act(async () => finishNew(result(4822)));
  expect(await screen.findByText('Warehouse #4822')).toBeInTheDocument();
  await act(async () => finishOld(result(4821)));
  expect(screen.queryByText('Warehouse #4821')).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Flag Review Queue' })).not.toBeInTheDocument();
});
