import { useMemo, useState } from 'react';

/**
 * useWarehouseFilters — shared warehouse search/filter state + logic.
 *
 * Owns every filter field and derives the filtered list from `items` (memoised,
 * so the returned `filtered` reference is stable until inputs change). Used by
 * both the dashboard and the review queue so the filter behaviour is single-source.
 *
 * @param {Array} items - Warehouse-shaped rows to filter
 * @returns {Object} { filtered, ...filterValues, ...setters, clearFilters }
 */
export function useWarehouseFilters(items = []) {
  const [searchText, setSearchText] = useState('');
  const [selectedOwnerType, setSelectedOwnerType] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const [fireNocFilter, setFireNocFilter] = useState('');
  const [selectedLandType, setSelectedLandType] = useState('');
  const [selectedUploadedBy, setSelectedUploadedBy] = useState('');
  const [selectedVisibility, setSelectedVisibility] = useState('');
  const [areaRange, setAreaRange] = useState([0, 100000]);
  const [budgetRange, setBudgetRange] = useState([0, 1000]);

  const clearFilters = () => {
    setSearchText('');
    setSelectedOwnerType('');
    setSelectedType('');
    setSelectedCity('');
    setSelectedState('');
    setSelectedZone('');
    setSelectedAvailability('');
    setSelectedBroker('');
    setFireNocFilter('');
    setSelectedLandType('');
    setSelectedUploadedBy('');
    setSelectedVisibility('');
    setAreaRange([0, 100000]);
    setBudgetRange([0, 1000]);
  };

  const filtered = useMemo(() => {
    let result = [...(items || [])];

    if (searchText) {
      result = result.filter(warehouse =>
        warehouse.id?.toString().includes(searchText) ||
        warehouse.warehouseType?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.address?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.city?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.contactPerson?.toLowerCase().includes(searchText.toLowerCase()) ||
        warehouse.warehouseOwnerType?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (selectedOwnerType) {
      result = result.filter(warehouse =>
        warehouse.warehouseOwnerType?.toLowerCase().includes(selectedOwnerType.toLowerCase())
      );
    }

    if (selectedType) {
      result = result.filter(warehouse =>
        warehouse.warehouseType?.toLowerCase().includes(selectedType.toLowerCase())
      );
    }

    if (selectedCity) {
      result = result.filter(warehouse =>
        warehouse.city?.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    if (selectedState) {
      result = result.filter(warehouse =>
        warehouse.state?.toLowerCase().includes(selectedState.toLowerCase())
      );
    }

    if (selectedZone) {
      result = result.filter(warehouse =>
        warehouse.zone?.toLowerCase().includes(selectedZone.toLowerCase())
      );
    }

    if (selectedAvailability) {
      result = result.filter(warehouse =>
        warehouse.availability?.toLowerCase().includes(selectedAvailability.toLowerCase())
      );
    }

    if (selectedBroker) {
      result = result.filter(warehouse =>
        warehouse.isBroker?.toLowerCase().includes(selectedBroker.toLowerCase())
      );
    }

    if (fireNocFilter) {
      result = result.filter(warehouse => {
        const fireNoc = warehouse.WarehouseData?.fireNocAvailable || warehouse.warehouseData?.fireNocAvailable;
        if (fireNocFilter === 'available') {
          return fireNoc === true;
        } else if (fireNocFilter === 'not_available') {
          return fireNoc === false || fireNoc === null || fireNoc === undefined;
        }
        return true;
      });
    }

    if (selectedLandType) {
      result = result.filter(warehouse =>
        (warehouse.WarehouseData?.landType || warehouse.warehouseData?.landType || '')
          .toLowerCase().includes(selectedLandType.toLowerCase())
      );
    }

    if (selectedUploadedBy) {
      result = result.filter(warehouse =>
        warehouse.uploadedBy?.toLowerCase().includes(selectedUploadedBy.toLowerCase())
      );
    }

    if (selectedVisibility) {
      result = result.filter(warehouse => {
        const isVisible = warehouse.visibility === true || warehouse.visibility === 'true' || warehouse.visibility === 1;
        if (selectedVisibility === 'visible') {
          return isVisible;
        } else if (selectedVisibility === 'hidden') {
          return !isVisible;
        }
        return true;
      });
    }

    if (areaRange[0] > 0 || areaRange[1] < 100000) {
      result = result.filter(warehouse => {
        const spaces = Array.isArray(warehouse.totalSpaceSqft)
          ? warehouse.totalSpaceSqft
          : [warehouse.totalSpaceSqft];
        return spaces.some(v => {
          const n = Number(v);
          return Number.isFinite(n) && n >= areaRange[0] && n <= areaRange[1];
        });
      });
    }

    if (budgetRange[0] > 0 || budgetRange[1] < 1000) {
      result = result.filter(warehouse => {
        const rate = parseFloat(warehouse.ratePerSqft?.replace(/[^\d.]/g, '') || 0);
        return rate >= budgetRange[0] && rate <= budgetRange[1];
      });
    }

    return result;
  }, [
    items, searchText, selectedOwnerType, selectedType, selectedCity, selectedState,
    selectedZone, selectedAvailability, selectedBroker, fireNocFilter, selectedLandType,
    selectedUploadedBy, selectedVisibility, areaRange, budgetRange,
  ]);

  return {
    filtered,
    searchText, setSearchText,
    selectedOwnerType, setSelectedOwnerType,
    selectedType, setSelectedType,
    selectedCity, setSelectedCity,
    selectedState, setSelectedState,
    selectedZone, setSelectedZone,
    selectedAvailability, setSelectedAvailability,
    selectedBroker, setSelectedBroker,
    fireNocFilter, setFireNocFilter,
    selectedLandType, setSelectedLandType,
    selectedUploadedBy, setSelectedUploadedBy,
    selectedVisibility, setSelectedVisibility,
    areaRange, setAreaRange,
    budgetRange, setBudgetRange,
    clearFilters,
  };
}

export default useWarehouseFilters;
