import { describe, it, expect } from 'vitest';
import { renderWithProviders } from './testUtils';
import { useAuth } from '../contexts/AuthContext';
import { warehouseService } from '../services/warehouseService';

describe('shared test environment', () => {
  it('provides an explicit auth state through the real context', () => {
    const Probe = () => <span>{useAuth().user.name}</span>;
    const view = renderWithProviders(<Probe />, { auth: { user: { name: 'Test user' } } });
    expect(view.getByText('Test user')).toBeInTheDocument();
  });

  it('intercepts the API and returns the paginated contract', async () => {
    const result = await warehouseService.list({ limit: 1, page: 2 });
    expect(result.data.map(row => row.id)).toEqual([2]);
    expect(result.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
  });

  it('preserves computed styles for visibility assertions', () => {
    const { getByText } = renderWithProviders(<span style={{ display: 'none' }}>Hidden content</span>);
    expect(getByText('Hidden content')).not.toBeVisible();
  });
});
