import WarehouseFilterBar from './WarehouseFilterBar';

// The toolbar owns the only search box. Keep this public adapter for callers.
export default function MobileFilterAccordion(filters) {
  return <WarehouseFilterBar filters={filters} showDateFilter={filters.showDateFilter} />;
}
