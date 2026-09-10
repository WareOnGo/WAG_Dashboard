import { useEffect, useMemo, useState } from 'react';
import { warehouseService } from '../services/warehouseService';
import { WAREHOUSE_TYPES } from '../utils/warehouseOptions';

const EMPTY_OPTIONS = { locations: [], warehouseTypes: [] };
const uniqueValues = values => [...new Set(values.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b));

export function useWarehouseFilterOptions(selectedState, rows) {
  const [remoteOptions, setRemoteOptions] = useState(EMPTY_OPTIONS);
  const [loading, setLoading] = useState(rows === undefined);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Review Queue already loads all submissions for its current status via API.
    // Its users do not necessarily have access to dashboard listings.
    if (rows !== undefined) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    warehouseService.getFilterOptions().then(options => {
      if (!cancelled) setRemoteOptions(options);
    }).catch(() => {
      if (!cancelled) setError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [rows, attempt]);

  const options = useMemo(() => {
    const source = rows === undefined ? remoteOptions : {
      locations: rows,
      warehouseTypes: rows.map(row => row.warehouseType),
    };
    const locations = source?.locations || [];
    const state = selectedState.trim().toLowerCase();
    return {
      states: uniqueValues(locations.map(row => row.state)),
      cities: uniqueValues(locations.filter(row => !state || row.state?.toLowerCase().includes(state)).map(row => row.city)),
      warehouseTypes: uniqueValues([...WAREHOUSE_TYPES, ...(source?.warehouseTypes || [])]),
    };
  }, [rows, remoteOptions, selectedState]);

  return { ...options, loading: rows === undefined && loading, error: rows === undefined && error, retry: () => setAttempt(value => value + 1) };
}
