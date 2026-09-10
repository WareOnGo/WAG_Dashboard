import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import CardView from '../CardView';
import ResponsiveTable from '../ResponsiveTable';
import { useViewport } from '../../hooks/useViewport';

vi.mock('../../hooks/useViewport', () => ({ useViewport: vi.fn() }));
const auth = { user: { isAdmin: true } };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); useViewport.mockReturnValue({ isMobile: false, isTablet: false }); });

describe('responsive data display behavior', () => {
  it('renders every row in a server-paginated card page', () => {
    useViewport.mockReturnValue({ isMobile: true });
    const warehouses = Array.from({ length: 8 }, (_, i) => ({ ...mockWarehouse, id: i + 1, photos: '', media: null }));
    renderWithProviders(<CardView warehouses={warehouses} paginated={false} />, { auth });
    expect(screen.getAllByRole('button', { name: /Edit/ })).toHaveLength(8);
    expect(screen.queryByTitle('Next Page')).not.toBeInTheDocument();
  });

  it('dispatches card actions with the warehouse, without also opening details', async () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), onViewDetails = vi.fn();
    renderWithProviders(<CardView warehouses={[mockWarehouse]} onEdit={onEdit} onDelete={onDelete} onViewDetails={onViewDetails} />, { auth });
    await userEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(mockWarehouse);
    expect(onViewDetails).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledWith(mockWarehouse);
  });

  it('hides card deletion for a non-admin', () => {
    renderWithProviders(<CardView warehouses={[mockWarehouse]} />, { auth: { user: { isAdmin: false } } });
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('renders table data and forwards pagination changes', async () => {
    const onChange = vi.fn();
    renderWithProviders(<ResponsiveTable rowKey="id" columns={[{ title: 'City', dataIndex: 'city' }]} dataSource={[mockWarehouse]}
      pagination={{ current: 1, pageSize: 1, total: 2, onChange }} />);
    expect(screen.getByRole('cell', { name: mockWarehouse.city })).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('2'));
    expect(onChange).toHaveBeenCalledWith(2, 1);
  });

});
