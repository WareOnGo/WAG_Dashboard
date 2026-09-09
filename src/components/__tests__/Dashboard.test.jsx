import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouses } from '../../test/mockData';
import Dashboard from '../Dashboard';
import AuthContext from '../../contexts/AuthContext';
import { warehouseService } from '../../services/warehouseService';

vi.mock('../../services/warehouseService', () => ({
  warehouseService: {
    list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    getCoordinates: vi.fn(), getContactNumber: vi.fn(),
  },
}));
vi.mock('../../services/imageLabelService', () => ({
  imageLabelService: { invalidate: vi.fn(), getCached: vi.fn(), getForWarehouse: vi.fn() },
}));
vi.mock('../../utils/errorHandler', async importOriginal => ({
  ...await importOriginal(), withRetry: fn => fn(), clearErrors: vi.fn(), showSuccessMessage: vi.fn(),
}));
// Form behavior has its own real-component suite. Here the form is the boundary
// for testing the dashboard's confirmation, persistence, and refresh behavior.
vi.mock('../WarehouseForm', () => ({ default: ({ visible, initialData, onSubmit, onCancel }) => visible && (
  <div role="dialog" aria-label="Warehouse editor">
    <span>{initialData ? `Editing ${initialData.id}` : 'New warehouse'}</span>
    <button onClick={() => onSubmit({ warehouseType: 'PEB', city: 'Bangalore', contactNumber: '9876543210' }).catch(() => {})}>Submit warehouse</button>
    <button onClick={onCancel}>Cancel editor</button>
  </div>
) }));
vi.mock('../MapView', () => ({ default: ({ warehouses }) => <div data-testid="map">{warehouses.map(w => w.id).join(',')}</div> }));
vi.mock('../VisitNotes', () => ({ default: () => null }));

const auth = { isAuthenticated: true, isLoading: false, user: { name: 'Tester', isAdmin: true, capabilities: { DASHBOARD: true } } };
const page = (data = mockWarehouses, total = data.length) => ({ data, pagination: { total } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const open = (session = auth) => renderWithProviders(<Dashboard />, { auth: session });
const loaded = () => screen.findByText('#1');
const search = () => screen.getByPlaceholderText('Search warehouses...');
const rowFor = id => screen.getByText(`#${id}`).closest('tr');
const settleDebounce = () => act(() => new Promise(resolve => setTimeout(resolve, 350)));

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(warehouseService).forEach(mock => mock.mockReset());
  localStorage.clear();
  localStorage.setItem('warehouse-view-preference', 'table');
  warehouseService.list.mockResolvedValue(page());
  warehouseService.getCoordinates.mockResolvedValue([]);
  warehouseService.getContactNumber.mockResolvedValue({ contactNumber: '9876543210' });
});

describe('Dashboard current list contract', () => {
  it('loads the server page with image labels and uses the server total', async () => {
    warehouseService.list.mockResolvedValue(page(mockWarehouses, 42));
    open();
    await loaded();
    expect(screen.getByText('2 of 42 results')).toBeInTheDocument();
    expect(warehouseService.list).toHaveBeenCalledWith({ page: 1, limit: 20, includeImageLabels: 'true' });
    await settleDebounce();
    expect(warehouseService.list).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...auth, isLoading: true },
    { ...auth, isAuthenticated: false, user: null },
    { ...auth, user: { capabilities: { DASHBOARD: false } } },
  ])('does not fetch before access is available: %j', async session => {
    open(session);
    await settleDebounce();
    expect(warehouseService.list).not.toHaveBeenCalled();
    expect(warehouseService.getCoordinates).not.toHaveBeenCalled();
  });

  it('starts loading once authentication finishes', async () => {
    const view = renderWithProviders(<AuthContext.Provider value={{ ...auth, isLoading: true }}><Dashboard /></AuthContext.Provider>);
    expect(warehouseService.list).not.toHaveBeenCalled();
    view.rerender(<AuthContext.Provider value={auth}><Dashboard /></AuthContext.Provider>);
    await loaded();
    expect(warehouseService.list).toHaveBeenCalledTimes(1);
  });

  it('shows empty results without reporting a network failure', async () => {
    warehouseService.list.mockResolvedValue(page([]));
    open();
    expect(await screen.findByText('0 of 0 results')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('retries a failed first load and restores the list', async () => {
    warehouseService.list.mockRejectedValueOnce(new Error('Network unavailable'));
    open();
    expect(await screen.findByText('Connection problem')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry').closest('button'));
    await loaded();
    expect(screen.queryByText('Connection problem')).not.toBeInTheDocument();
  });

  it('searches on the server and clears the search parameter', async () => {
    open();
    await loaded();
    warehouseService.list.mockResolvedValue(page([mockWarehouses[1]]));
    fireEvent.change(search(), { target: { value: 'Storage' } });
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Storage', page: 1 })));
    expect(await screen.findByText('1 of 1 results')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    warehouseService.list.mockResolvedValue(page());
    fireEvent.change(search(), { target: { value: '' } });
    await loaded();
    expect(warehouseService.list.mock.lastCall[0]).not.toHaveProperty('search');
  });

  it('changes server pages and returns to page one after a filter changes', async () => {
    warehouseService.list.mockResolvedValue(page(mockWarehouses, 42));
    open();
    await loaded();
    await settleDebounce();
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    fireEvent.change(search(), { target: { value: 'PEB' } });
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'PEB', page: 1 })));
  });

  it('ignores an older response after a newer search has completed', async () => {
    const older = deferred();
    warehouseService.list.mockReturnValueOnce(older.promise);
    open();
    warehouseService.list.mockResolvedValue(page([mockWarehouses[1]]));
    fireEvent.change(search(), { target: { value: 'Storage' } });
    await screen.findByText('#2');
    await act(async () => older.resolve(page([mockWarehouses[0]])));
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 1 results')).toBeInTheDocument();
  });

  it('keeps existing rows visible when a refresh fails', async () => {
    open();
    await loaded();
    warehouseService.list.mockRejectedValueOnce(new Error('Server unavailable'));
    fireEvent.change(search(), { target: { value: 'PEB' } });
    expect(await screen.findByText('Error: Server unavailable')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });
});

describe('Dashboard mutations', () => {
  it.each([true, false])('handles visibility update success=%s without leaving stale state', async succeeds => {
    localStorage.setItem('warehouse-view-preference', 'cards');
    const update = deferred();
    warehouseService.update.mockReturnValue(update.promise);
    open();
    await loaded();
    const status = () => screen.getByText('#1').closest('.simple-warehouse-card').querySelector('[title="Click to toggle visibility"]');
    fireEvent.click(status());
    expect(status()).toHaveTextContent('hidden');
    expect(warehouseService.update).toHaveBeenCalledWith(1, expect.objectContaining({ visibility: false }));
    warehouseService.list.mockResolvedValue(page([{ ...mockWarehouses[0], visibility: false }, mockWarehouses[1]]));
    await act(async () => {
      if (succeeds) update.resolve({ ...mockWarehouses[0], visibility: false });
      else update.reject(new Error('Update failed'));
    });
    await waitFor(() => expect(warehouseService.list).toHaveBeenCalledTimes(succeeds ? 2 : 1));
    expect(status()).toHaveTextContent(succeeds ? 'hidden' : 'visible');
  });

  it.each([
    [{ warehouseId: 73, submissionId: 'submission-73' }, 'Warehouse created', 2],
    [{ warehouseId: null, submissionId: 'pending-73' }, 'Submitted for review', 1],
  ])('handles the submission receipt %j', async (receipt, title, calls) => {
    warehouseService.create.mockResolvedValue(receipt);
    open();
    await loaded();
    fireEvent.click(screen.getByText('Add Warehouse').closest('button'));
    fireEvent.click(await screen.findByText('Submit warehouse'));
    expect(warehouseService.create).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('Yes, Create'));
    expect((await screen.findAllByText(title)).length).toBeGreaterThan(0);
    await waitFor(() => expect(warehouseService.list).toHaveBeenCalledTimes(calls));
    expect(screen.queryByRole('dialog', { name: 'Warehouse editor' })).not.toBeInTheDocument();
  });

  it('does not create when confirmation is cancelled', async () => {
    open();
    await loaded();
    fireEvent.click(screen.getByText('Add Warehouse').closest('button'));
    fireEvent.click(await screen.findByText('Submit warehouse'));
    fireEvent.click(await screen.findByText('Cancel', { selector: 'button span' }));
    expect(warehouseService.create).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Warehouse editor' })).toBeInTheDocument();
  });

  it('requires confirmation before deleting a warehouse', async () => {
    warehouseService.delete.mockResolvedValue({ status: 204 });
    open();
    await loaded();
    warehouseService.list.mockResolvedValue(page([mockWarehouses[1]]));
    fireEvent.contextMenu(rowFor(1));
    fireEvent.click(screen.getByText('Delete'));
    expect(warehouseService.delete).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('Yes, Delete'));
    await waitFor(() => expect(warehouseService.delete).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('#1')).not.toBeInTheDocument());
  });
});

describe('Dashboard mutation and session regressions', () => {
  it('refreshes the active filter after an edit removes a matching warehouse', async () => {
    warehouseService.list.mockResolvedValue(page([mockWarehouses[0]]));
    warehouseService.update.mockResolvedValue({ ...mockWarehouses[0], warehouseType: 'PEB' });
    open();
    await loaded();
    fireEvent.change(search(), { target: { value: 'Industrial' } });
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Industrial' })));
    fireEvent.contextMenu(rowFor(1));
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(await screen.findByText('Submit warehouse'));
    warehouseService.list.mockResolvedValue(page([]));
    fireEvent.click(await screen.findByText('Yes, Update'));
    expect(await screen.findByText('0 of 0 results')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(warehouseService.update).toHaveBeenCalledWith(1, expect.objectContaining({ warehouseType: 'PEB' }));
  });

  it('refreshes open map markers after deletion', async () => {
    localStorage.setItem('warehouse-view-preference', 'cards');
    warehouseService.getCoordinates.mockResolvedValue([{ id: 1, lat: 12, lng: 77 }, { id: 2, lat: 13, lng: 78 }]);
    warehouseService.delete.mockResolvedValue({ status: 204 });
    open();
    await loaded();
    fireEvent.click(screen.getByText('Show Map').closest('button'));
    expect(await screen.findByTestId('map')).toHaveTextContent('1,2');
    warehouseService.list.mockResolvedValue(page([mockWarehouses[1]]));
    warehouseService.getCoordinates.mockResolvedValue([{ id: 2, lat: 13, lng: 78 }]);
    fireEvent.click(screen.getAllByText('Delete')[0]);
    fireEvent.click(await screen.findByText('Yes, Delete'));
    await waitFor(() => expect(screen.getByTestId('map')).toHaveTextContent(/^2$/));
  });

  it('refreshes the current search when deletion finishes after the search changes', async () => {
    const deletion = deferred();
    warehouseService.delete.mockReturnValue(deletion.promise);
    open();
    await loaded();
    fireEvent.contextMenu(rowFor(1));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(await screen.findByText('Yes, Delete'));
    warehouseService.list.mockImplementation(params => Promise.resolve(params.search ? page([mockWarehouses[1]]) : page()));
    fireEvent.change(search(), { target: { value: 'Storage' } });
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Storage' })));
    await act(async () => deletion.resolve({ status: 204 }));
    await waitFor(() => expect(warehouseService.list).toHaveBeenCalledTimes(3));
    expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Storage' }));
    expect(screen.getByText('1 of 1 results')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
  });

  it('refreshes the server total and rows after deletion', async () => {
    warehouseService.delete.mockResolvedValue({ status: 204 });
    open();
    await loaded();
    warehouseService.list.mockResolvedValue(page([mockWarehouses[1]], 1));
    fireEvent.contextMenu(rowFor(1));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(await screen.findByText('Yes, Delete'));
    expect(await screen.findByText('1 of 1 results')).toBeInTheDocument();
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
  });

  it('returns to the preceding page when its last warehouse is deleted', async () => {
    const last = { ...mockWarehouses[0], id: 21 };
    warehouseService.list.mockImplementation(({ page: requested }) => Promise.resolve(requested === 2 ? page([last], 21) : page(mockWarehouses, 21)));
    warehouseService.delete.mockResolvedValue({ status: 204 });
    open();
    await loaded();
    await settleDebounce();
    fireEvent.click(screen.getByTitle('2'));
    await screen.findByText('#21');
    warehouseService.list.mockImplementation(({ page: requested }) => Promise.resolve(requested === 2 ? page([], 20) : page(mockWarehouses, 20)));
    fireEvent.contextMenu(rowFor(21));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(await screen.findByText('Yes, Delete'));
    await loaded();
    expect(screen.getByText('2 of 20 results')).toBeInTheDocument();
    expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('does not return to page one when a temporary search is erased before debounce', async () => {
    warehouseService.list.mockResolvedValue(page(mockWarehouses, 42));
    open();
    await loaded();
    await settleDebounce();
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(warehouseService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
    const calls = warehouseService.list.mock.calls.length;
    fireEvent.change(search(), { target: { value: 'temporary' } });
    fireEvent.change(search(), { target: { value: '' } });
    await settleDebounce();
    expect(warehouseService.list).toHaveBeenCalledTimes(calls);
    expect(screen.getByTitle('2')).toHaveClass('ant-pagination-item-active');
  });

  it('discards an in-flight page when dashboard access is revoked', async () => {
    const request = deferred();
    warehouseService.list.mockReturnValueOnce(request.promise);
    const view = renderWithProviders(<AuthContext.Provider value={auth}><Dashboard /></AuthContext.Provider>);
    const denied = { ...auth, user: { capabilities: { DASHBOARD: false } } };
    view.rerender(<AuthContext.Provider value={denied}><Dashboard /></AuthContext.Provider>);
    await act(async () => request.resolve(page()));
    warehouseService.list.mockReturnValue(new Promise(() => {}));
    view.rerender(<AuthContext.Provider value={auth}><Dashboard /></AuthContext.Provider>);
    expect(screen.queryByText('#1')).not.toBeInTheDocument();
    expect(screen.queryByText('2 of 2 results')).not.toBeInTheDocument();
  });

  it('clears map markers when dashboard access is revoked', async () => {
    localStorage.setItem('warehouse-view-preference', 'cards');
    warehouseService.getCoordinates.mockResolvedValue([{ id: 1, lat: 12, lng: 77 }]);
    const view = renderWithProviders(<AuthContext.Provider value={auth}><Dashboard /></AuthContext.Provider>);
    await loaded();
    fireEvent.click(screen.getByText('Show Map').closest('button'));
    expect(await screen.findByTestId('map')).toHaveTextContent('1');
    const denied = { ...auth, user: { capabilities: { DASHBOARD: false } } };
    view.rerender(<AuthContext.Provider value={denied}><Dashboard /></AuthContext.Provider>);
    warehouseService.getCoordinates.mockReturnValue(new Promise(() => {}));
    await act(async () => { view.rerender(<AuthContext.Provider value={auth}><Dashboard /></AuthContext.Provider>); });
    expect(screen.getByTestId('map')).toBeEmptyDOMElement();
  });
});
