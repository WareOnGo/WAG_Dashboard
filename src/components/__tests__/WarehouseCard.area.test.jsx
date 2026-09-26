import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import { mockWarehouse } from '../../test/mockData';
import WarehouseCard from '../WarehouseCard';

vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: true }) }));

describe('expanded warehouse area', () => {
  it('shows current area options when a conflicting legacy value exists', () => {
    renderWithProviders(<WarehouseCard warehouse={{
      ...mockWarehouse, photos: '', media: null, totalSpaceSqft: [25000, 50000], offeredSpaceSqft: '99999',
    }} />, { auth: { user: null } });
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(screen.getByText('Offered Area: 25,000 / 50,000 sq ft')).toBeInTheDocument();
    expect(screen.queryByText(/99999/)).not.toBeInTheDocument();
  });

  it('does not show a legacy area when current areas are missing', () => {
    renderWithProviders(<WarehouseCard warehouse={{
      ...mockWarehouse, photos: '', media: null, totalSpaceSqft: [], offeredSpaceSqft: '99999', clearHeightFt: '30',
    }} />, { auth: { user: null } });
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(screen.queryByText(/^Offered Area:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/99999/)).not.toBeInTheDocument();
    expect(screen.getByText('Clear Height: 30 ft')).toBeInTheDocument();
  });
});
