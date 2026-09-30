import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminUsers from '../AdminUsers';
import { verifiedNumberService } from '../../services/verifiedNumberService';

const state = vi.hoisted(() => ({ admin: true, mobile: false,
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, modal: { confirm: vi.fn() },
}));
vi.mock('../../contexts', () => ({ useAuth: () => ({ user: { isAdmin: state.admin, isAnalyst: true, email: 'owner@wareongo.com' } }) }));
vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: state.mobile }) }));
vi.mock('antd', async original => ({ ...await original(), App: { useApp: () => ({ message: state.message, modal: state.modal }) } }));
vi.mock('../../services/verifiedNumberService', () => ({ verifiedNumberService: { adminList: vi.fn(), adminUpdate: vi.fn() } }));
const employee = { id: 2, name: 'Synthetic colleague', email: 'colleague@wareongo.com', is_active: true, adminAccess: false, analystAccess: false };
const admin = { ...employee, id: 1, name: 'Synthetic admin', email: 'owner@wareongo.com', adminAccess: true };

beforeEach(() => {
  state.admin = true; state.mobile = false; vi.clearAllMocks();
  verifiedNumberService.adminList.mockResolvedValue([admin, employee]);
  verifiedNumberService.adminUpdate.mockImplementation(async (_id, changes) => ({ ...employee, ...changes }));
});
describe('main dashboard Analyst access', () => {
  it.each([false, true])('shows and saves the Analyst toggle in mobile=%s', async mobile => {
    state.mobile = mobile;
    render(<AdminUsers />);
    const toggle = await screen.findByRole('switch', { name: 'Analyst access for Synthetic colleague' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await waitFor(() => expect(verifiedNumberService.adminUpdate).toHaveBeenCalledWith(2, { analystAccess: true }));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(state.message.info).toHaveBeenCalledWith(expect.stringContaining('reconnect Claude'), 8);
    fireEvent.click(toggle);
    await waitFor(() => expect(verifiedNumberService.adminUpdate).toHaveBeenLastCalledWith(2, { analystAccess: false }));
  });
  it('renders admin inheritance without an editable Analyst switch', async () => {
    render(<AdminUsers />);
    const row = (await screen.findByText('Synthetic admin')).closest('tr');
    expect(within(row).getAllByText('via admin')).toHaveLength(4);
    expect(screen.queryByRole('switch', { name: 'Analyst access for Synthetic admin' })).not.toBeInTheDocument();
  });
  it('keeps the roster editor unavailable to an Analyst without admin access', () => {
    state.admin = false;
    render(<AdminUsers />);
    expect(screen.getByText('Admins only')).toBeInTheDocument();
    expect(verifiedNumberService.adminList).not.toHaveBeenCalled();
  });
  it('keeps the saved value on a rejected permission change', async () => {
    verifiedNumberService.adminUpdate.mockRejectedValue(new Error('Access changed'));
    render(<AdminUsers />);
    const toggle = await screen.findByRole('switch', { name: 'Analyst access for Synthetic colleague' });
    fireEvent.click(toggle);
    await waitFor(() => expect(state.message.error).toHaveBeenCalled());
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
