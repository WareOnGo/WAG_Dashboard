import { act, renderHook } from '@testing-library/react';
import { useWarehouseFilters } from '../useWarehouseFilters';

const rows = [
  { id: 1, contactPerson: 'A. Sharma', ownerCompanyName: 'Acme', listing_type: 'Rent', status: 'Ready to move', WarehouseData: { fireNocAvailable: true, landType: 'Industrial' }, ratePerSqft: '₹25' },
  { id: 2, contactPerson: 'B. Sharma', ownerCompanyName: 'Acme', listing_type: 'Rent', status: 'Ready to move', fireNocAvailable: true, landType: 'Industrial', ratePerSqft: 30 },
  { id: 3, contactPerson: 'Other', ownerCompanyName: 'Other', listing_type: 'Sale', status: 'Under construction', warehouseData: { fireNocAvailable: false } },
  { id: 4, fireNocAvailable: false },
  { id: 5, fireNocAvailable: null },
  { id: 6 },
];

describe('shared warehouse filters', () => {
  it('combines owner, listing type, status and flat/nested technical fields', () => {
    const { result } = renderHook(() => useWarehouseFilters(rows));
    act(() => {
      result.current.setSelectedOwnerName('sharma');
      result.current.setSelectedListingType('Rent');
      result.current.setSelectedStatus('ready');
      result.current.setFireNocFilter('available');
      result.current.setSelectedLandType('industrial');
      result.current.setBudgetRange([20, 35]);
    });
    expect(result.current.filtered.map(row => row.id)).toEqual([1, 2]);
    expect(result.current.queryParams).toEqual({ contactPerson: 'sharma', listing_type: 'Rent', status: 'ready', fireNoc: 'available', landType: 'industrial', minRate: 20, maxRate: 35 });
    act(() => result.current.clearFilters());
    expect(result.current.filtered).toEqual(rows);
    expect(result.current.queryParams).toEqual({});
  });

  it('distinguishes true from false and missing Fire NOC in submissions and listings', () => {
    const { result } = renderHook(() => useWarehouseFilters(rows));
    act(() => result.current.setFireNocFilter('available'));
    expect(result.current.filtered.map(row => row.id)).toEqual([1, 2]);
    act(() => result.current.setFireNocFilter('not_available'));
    expect(result.current.filtered.map(row => row.id)).toEqual([3, 4, 5, 6]);
  });

  it('accepts large areas and sale rates with inclusive explicit maximums', () => {
    const largeRows = [
      { id: 1, totalSpaceSqft: [500000], ratePerSqft: '₹2,700' },
      { id: 2, totalSpaceSqft: [10000000], ratePerSqft: '10000' },
      { id: 3, totalSpaceSqft: [11000000], ratePerSqft: '12000' },
    ];
    const { result } = renderHook(() => useWarehouseFilters(largeRows));
    expect(result.current.queryParams).toEqual({});
    expect(result.current.filtered).toEqual(largeRows);
    act(() => {
      result.current.setAreaRange([200000, 10000000]);
      result.current.setBudgetRange([1000, 10000]);
    });
    expect(result.current.filtered.map(row => row.id)).toEqual([1, 2]);
    expect(result.current.queryParams).toEqual({ minArea: 200000, maxArea: 10000000, minRate: 1000, maxRate: 10000 });
    act(() => {
      result.current.setAreaRange([200000, null]);
      result.current.setBudgetRange([1000, null]);
    });
    expect(result.current.filtered).toEqual(largeRows);
    expect(result.current.queryParams).toEqual({ minArea: 200000, minRate: 1000 });
    act(() => result.current.clearFilters());
    expect(result.current.areaRange).toEqual([0, null]);
    expect(result.current.budgetRange).toEqual([0, null]);
    expect(result.current.queryParams).toEqual({});
  });
});
