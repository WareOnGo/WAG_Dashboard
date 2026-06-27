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
  // [from, to] as 'YYYY-MM-DD' strings (null when unset). Used by the review queue
  // to filter staged rows by submission date (submittedAt) / approval date (reviewedAt).
  const [submittedDateRange, setSubmittedDateRange] = useState([null, null]);
  const [reviewedDateRange, setReviewedDateRange] = useState([null, null]);

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
    setSubmittedDateRange([null, null]);
    setReviewedDateRange([null, null]);
  };

  // True when `value` (a DateTime) falls within [from, to] (inclusive, day-granular).
  // Empty range → always passes; missing value against a set range → excluded.
  const matchesDateRange = (value, [from, to]) => {
    if (!from && !to) return true;
    if (!value) return false;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return false;
    if (from && t < new Date(`${from}T00:00:00`).getTime()) return false;
    if (to && t > new Date(`${to}T23:59:59.999`).getTime()) return false;
    return true;
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

    if (submittedDateRange[0] || submittedDateRange[1]) {
      result = result.filter(warehouse => matchesDateRange(warehouse.submittedAt, submittedDateRange));
    }

    if (reviewedDateRange[0] || reviewedDateRange[1]) {
      result = result.filter(warehouse => matchesDateRange(warehouse.reviewedAt, reviewedDateRange));
    }

    return result;
  }, [
    items, searchText, selectedOwnerType, selectedType, selectedCity, selectedState,
    selectedZone, selectedAvailability, selectedBroker, fireNocFilter, selectedLandType,
    selectedUploadedBy, selectedVisibility, areaRange, budgetRange,
    submittedDateRange, reviewedDateRange,
  ]);

  // Serialize the active filters into backend query params for server-side
  // fetching (Dashboard). Only non-default values are included. The date ranges
  // are review-queue-only (client-side) and intentionally excluded — the warehouse
  // list endpoint doesn't support them. The dashboard uses this; the review queue
  // keeps using `filtered` (client-side) above.
  const queryParams = useMemo(() => {
    const p = {};
    if (searchText) p.search = searchText;
    if (selectedOwnerType) p.warehouseOwnerType = selectedOwnerType;
    if (selectedType) p.warehouseType = selectedType;
    if (selectedCity) p.city = selectedCity;
    if (selectedState) p.state = selectedState;
    if (selectedZone) p.zone = selectedZone;
    if (selectedAvailability) p.availability = selectedAvailability;
    if (selectedBroker) p.isBroker = selectedBroker;
    if (fireNocFilter) p.fireNoc = fireNocFilter;
    if (selectedLandType) p.landType = selectedLandType;
    if (selectedUploadedBy) p.uploadedBy = selectedUploadedBy;
    if (selectedVisibility) p.visibility = selectedVisibility;
    if (areaRange[0] > 0) p.minArea = areaRange[0];
    if (areaRange[1] < 100000) p.maxArea = areaRange[1];
    if (budgetRange[0] > 0) p.minRate = budgetRange[0];
    if (budgetRange[1] < 1000) p.maxRate = budgetRange[1];
    return p;
  }, [
    searchText, selectedOwnerType, selectedType, selectedCity, selectedState,
    selectedZone, selectedAvailability, selectedBroker, fireNocFilter, selectedLandType,
    selectedUploadedBy, selectedVisibility, areaRange, budgetRange,
  ]);

  return {
    filtered,
    queryParams,
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
    submittedDateRange, setSubmittedDateRange,
    reviewedDateRange, setReviewedDateRange,
    clearFilters,
  };
}

export default useWarehouseFilters;
