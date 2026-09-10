import { act, renderHook, waitFor } from '@testing-library/react';
import { warehouseService } from '../../services/warehouseService';
import { useWarehouseFilterOptions } from '../useWarehouseFilterOptions';

vi.mock('../../services/warehouseService', () => ({ warehouseService: { getFilterOptions: vi.fn() } }));

describe('warehouse filter suggestions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('loads metadata once, narrows cities locally, preserves legacy types and removes blank values', async () => {
    warehouseService.getFilterOptions.mockResolvedValue({ locations: [
      { state: 'Karnataka', city: 'Bengaluru' }, { state: 'Karnataka', city: ' Mysuru ' },
      { state: 'Karnataka', city: 'Mysuru' }, { state: 'Tamil Nadu', city: 'Chennai' },
      { state: null, city: '' },
    ], warehouseTypes: ['Legacy cold storage', 'PEB', null] });
    const { result, rerender } = renderHook(({ state }) => useWarehouseFilterOptions(state), { initialProps: { state: '' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.states).toEqual(['Karnataka', 'Tamil Nadu']);
    expect(result.current.cities).toEqual(['Bengaluru', 'Chennai', 'Mysuru']);
    expect(result.current.warehouseTypes).toEqual(['BTS', 'Legacy cold storage', 'PEB', 'RCC', 'Shed']);
    rerender({ state: 'karna' });
    expect(result.current.cities).toEqual(['Bengaluru', 'Mysuru']);
    rerender({ state: 'Tamil Nadu' });
    expect(result.current.cities).toEqual(['Chennai']);
    expect(warehouseService.getFilterOptions).toHaveBeenCalledTimes(1);
  });

  it('uses review submissions without requiring dashboard API access and refreshes on status changes', () => {
    const { result, rerender } = renderHook(({ rows }) => useWarehouseFilterOptions('', rows), {
      initialProps: { rows: [{ state: 'Karnataka', city: 'Mysuru', warehouseType: 'Old type' }] },
    });
    expect(result.current.cities).toEqual(['Mysuru']);
    expect(result.current.warehouseTypes).toContain('Old type');
    rerender({ rows: [{ state: 'Tamil Nadu', city: 'Chennai' }] });
    expect(result.current.cities).toEqual(['Chennai']);
    expect(warehouseService.getFilterOptions).not.toHaveBeenCalled();
  });

  it('keeps default types on failure and recovers when retry succeeds', async () => {
    warehouseService.getFilterOptions.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ locations: [{ state: 'Delhi', city: 'Delhi' }], warehouseTypes: [] });
    const { result } = renderHook(() => useWarehouseFilterOptions(''));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.warehouseTypes).toContain('PEB');
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.states).toEqual(['Delhi']));
    expect(result.current.error).toBe(false);
  });
});
