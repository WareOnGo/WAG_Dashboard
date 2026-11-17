import { act, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../../../contexts/AuthContext';
import FieldReviewQueue from '../../FieldReviewQueue';
import { fieldReviewService } from '../../../services/fieldReviewService';

vi.mock('../../../services/fieldReviewService', () => ({ fieldReviewService: { list: vi.fn() } }));
vi.mock('../../CardView', () => ({ default: ({ warehouses }) => <div>{warehouses.map(w => <p key={w.id}>Warehouse #{w.id}</p>)}</div> }));
vi.mock('../FieldReviewDialog', () => ({ default: () => null }));
const result = id => ({ data: [{ id: crypto.randomUUID(), warehouseId: id, warehouse: {}, flags: [], activeCount: 1 }], counts: {}, pagination: { total: 1, totalPages: 1 } });
const tree = user => <MemoryRouter><AuthContext.Provider value={{ user }}><App><FieldReviewQueue /></App></AuthContext.Provider></MemoryRouter>;

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
