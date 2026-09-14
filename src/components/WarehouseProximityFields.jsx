import { useEffect, useId, useState } from 'react';
import { Button } from 'antd';
import { warehouseService } from '../services/warehouseService';
import './WarehouseProximityFields.css';

// Keep labels and search radii aligned with backend utils/proximityCategories.js.
const CATEGORIES = [
  { key: 'national_highway', label: 'Nearest Highway', radius: 50 },
  { key: 'aerodrome', label: 'Nearest Airport', radius: 200 },
  { key: 'railway_station', label: 'Nearest Railway Station', radius: 100 },
  { key: 'seaport', label: 'Nearest Port', radius: 300 },
  { key: 'city_centre', label: 'Nearest City Centre', radius: 100 },
  { key: 'bus_station', label: 'Nearest Bus Station', radius: 25 },
  { key: 'hospital', label: 'Nearest Hospital', radius: 25 },
  { key: 'fire_station', label: 'Nearest Fire Station', radius: 25 },
  { key: 'police', label: 'Nearest Police Station', radius: 25 },
  { key: 'fuel', label: 'Nearest Fuel Station', radius: 15 },
];

const numericId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
};

const statusValue = (primary) => ({ primary, secondary: '', isStatus: true });
const landmarkValue = (row, secondary) => ({
  primary: row.landmarkName || 'Unnamed landmark',
  secondary,
  isStatus: !row.landmarkName,
});

const formatProximity = (row, category, coordinates) => {
  if (!row) return statusValue('Not computed yet');

  // A saved or unsaved location correction makes the old measurements stale.
  const moved = [['computedFromLat', 'latitude'], ['computedFromLng', 'longitude']]
    .some(([from, current]) => row[from] != null && coordinates && (
      coordinates[current] == null || coordinates[current] === ''
      || Number(coordinates[current]) !== row[from]
    ));
  if (moved) return statusValue('Awaiting recalculation for this location');
  if (row.status === 'NONE_IN_RANGE') return statusValue(`None within ${category.radius} km`);
  if (row.status === 'ROUTING_FAILED') {
    return row.landmarkName ? landmarkValue(row, 'Route unavailable') : statusValue('Route unavailable');
  }
  if (!['OK', 'IDENTITY_ONLY'].includes(row.status)) return statusValue('Not available');

  if (category.key === 'national_highway' && row.warnings?.includes('ON_HIGHWAY')) {
    return landmarkValue(row, 'Direct highway access');
  }

  const hasDistance = Number.isFinite(row.roadKm) && row.roadKm >= 0;
  // Highway entry enrichment can supply a real distance even for an identity category.
  if (!hasDistance && row.status === 'IDENTITY_ONLY') return landmarkValue(row, 'Distance not calculated');
  const distance = hasDistance
    ? `${row.roadKm > 0 && row.roadKm < 0.01 ? '<0.01' : Number(row.roadKm.toFixed(row.roadKm < 1 ? 2 : 1))} km by road`
    : 'Distance unavailable';
  const time = Number.isFinite(row.driveMinutes) && row.driveMinutes >= 0
    ? `${row.driveMinutes === 0 ? '<1' : row.driveMinutes} min drive`
    : '';
  return landmarkValue(row, [distance, time].filter(Boolean).join(' · '));
};

const WarehouseProximityFields = ({ warehouse, disabled = false, coordinates }) => {
  const id = useId();
  const warehouseId = numericId(warehouse?.id) ?? numericId(warehouse?.warehouseId);
  const supplied = warehouse?.WarehouseProximity ?? warehouse?.warehouseProximity;
  const [fetched, setFetched] = useState({ id: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!warehouseId || Array.isArray(supplied)) return undefined;
    const controller = new AbortController();
    setFetched({ id: warehouseId });
    // This GET only reads backfilled database rows; it never runs enrichment.
    warehouseService.getById(warehouseId, { signal: controller.signal })
      .then((detail) => {
        if (controller.signal.aborted) return;
        const rows = detail?.WarehouseProximity ?? detail?.warehouseProximity;
        if (!Array.isArray(rows)) throw new Error('Missing warehouse proximity data');
        setFetched({ id: warehouseId, rows });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetched({ id: warehouseId, error: true });
      });
    return () => { controller.abort(); };
  }, [warehouseId, supplied, attempt]);

  // Tag responses with their warehouse so switching records never shows old values.
  const rows = Array.isArray(supplied) ? supplied
    : !warehouseId ? [] : fetched.id === warehouseId ? fetched.rows : undefined;
  const failed = !rows && fetched.id === warehouseId && fetched.error;
  const stored = new Map((rows || []).map(row => [row.category, row]));
  const location = coordinates ?? warehouse?.WarehouseData ?? warehouse?.warehouseData;

  return (
    <section
      className={`warehouse-proximity${disabled ? ' warehouse-proximity--readonly' : ''}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-help`}
    >
      <h3 id={`${id}-title`}>Geoproximity</h3>
      <p id={`${id}-help`} className="warehouse-proximity__help">
        Automatically calculated from the warehouse location.{disabled && ' These fields cannot be edited.'}
      </p>
      {failed ? (
        <div role="status" className="warehouse-proximity__help">
          Could not load geoproximity.{' '}
          <Button htmlType="button" size="small" onClick={() => setAttempt(value => value + 1)}>Retry</Button>
        </div>
      ) : !rows ? (
        <p role="status" className="warehouse-proximity__help">Loading geoproximity…</p>
      ) : (
        <dl className="warehouse-proximity__grid">
          {CATEGORIES.map(category => {
            const value = formatProximity(stored.get(category.key), category, location);
            return (
              <div key={category.key} className={`warehouse-proximity__field${value.isStatus ? ' warehouse-proximity__field--status' : ''}`}>
                <dt className="warehouse-proximity__label">
                  {category.label}
                </dt>
                <dd className="warehouse-proximity__value">
                  <span className="warehouse-proximity__name">{value.primary}</span>
                  {value.secondary && <span className="warehouse-proximity__detail">{value.secondary}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </section>
  );
};

export default WarehouseProximityFields;
