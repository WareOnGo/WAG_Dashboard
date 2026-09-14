import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import WarehouseProximityFields from '../WarehouseProximityFields';
import { warehouseService } from '../../services/warehouseService';

vi.mock('../../services/warehouseService', () => ({ warehouseService: { getById: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

const airport = { category: 'aerodrome', status: 'OK', landmarkName: 'Bengaluru Airport', roadKm: 24.64, driveMinutes: 35 };
const field = name => screen.getByText(name, { selector: 'dt' }).nextElementSibling;

it('shows saved road metrics and distinguishes missing, unroutable and identity-only results', () => {
  render(<WarehouseProximityFields disabled warehouse={{ id: 1, WarehouseProximity: [
    airport,
    { category: 'national_highway', status: 'IDENTITY_ONLY', landmarkName: 'NH-48', roadKm: null },
    { category: 'railway_station', status: 'ROUTING_FAILED', landmarkName: 'Central Station' },
    { category: 'seaport', status: 'NONE_IN_RANGE' },
    { category: 'fuel', status: 'OK', landmarkName: 'Fuel stop', roadKm: 0.01, driveMinutes: 0 },
  ] }} />);
  expect(field('Nearest Airport')).toHaveTextContent('Bengaluru Airport');
  expect(field('Nearest Airport')).toHaveTextContent('24.6 km by road · 35 min drive');
  expect(field('Nearest Highway')).toHaveTextContent('NH-48');
  expect(field('Nearest Highway')).toHaveTextContent('Distance not calculated');
  expect(field('Nearest Railway Station')).toHaveTextContent('Central Station');
  expect(field('Nearest Railway Station')).toHaveTextContent('Route unavailable');
  expect(field('Nearest Port')).toHaveTextContent('None within 300 km');
  expect(field('Nearest Hospital')).toHaveTextContent('Not computed yet');
  expect(field('Nearest Fuel Station')).toHaveTextContent('Fuel stop');
  expect(field('Nearest Fuel Station')).toHaveTextContent('0.01 km by road · <1 min drive');
  expect(screen.getAllByRole('term')).toHaveLength(10);
  expect(screen.getAllByRole('definition')).toHaveLength(10);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Geoproximity' })).toHaveAccessibleDescription(/These fields cannot be edited/);
  expect(warehouseService.getById).not.toHaveBeenCalled();
});

it('shows measured highway entry distances and recognises direct highway access', () => {
  const highway = { category: 'national_highway', status: 'OK', landmarkName: 'NH-48', roadKm: 1.7, driveMinutes: 4 };
  const { rerender } = render(<WarehouseProximityFields warehouse={{ WarehouseProximity: [highway] }} />);
  expect(screen.getByText(/1.7 km by road · 4 min drive/)).toBeInTheDocument();
  rerender(<WarehouseProximityFields warehouse={{ WarehouseProximity: [{ ...highway, roadKm: 0.01, warnings: ['ON_HIGHWAY'] }] }} />);
  expect(screen.getByText(/Direct highway access/)).toBeInTheDocument();
  expect(screen.queryByText(/0.01 km/)).not.toBeInTheDocument();
});

it('discards an earlier warehouse response when a different warehouse is opened', async () => {
  let resolveFirst;
  warehouseService.getById
    .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ WarehouseProximity: [{ ...airport, landmarkName: 'Mumbai Airport' }] });
  const { rerender } = render(<WarehouseProximityFields warehouse={{ id: 1 }} />);
  const firstSignal = warehouseService.getById.mock.calls[0][1].signal;
  expect(screen.getByRole('status')).toHaveTextContent('Loading geoproximity');
  rerender(<WarehouseProximityFields warehouse={{ id: 2 }} />);
  expect(firstSignal.aborted).toBe(true);
  expect(await screen.findByText(/Mumbai Airport/)).toBeInTheDocument();
  await act(async () => resolveFirst({ WarehouseProximity: [airport] }));
  expect(screen.queryByText(/Bengaluru Airport/)).not.toBeInTheDocument();
  expect(screen.getByText(/Mumbai Airport/)).toBeInTheDocument();
});

it('preserves a multiline landmark name without interpreting part of it as travel data', () => {
  render(<WarehouseProximityFields warehouse={{ WarehouseProximity: [{ ...airport, landmarkName: 'Airport\nTerminal 2' }] }} />);
  expect(field('Nearest Airport').querySelector('.warehouse-proximity__name').textContent).toBe('Airport\nTerminal 2');
  expect(field('Nearest Airport').querySelector('.warehouse-proximity__detail').textContent).toBe('24.6 km by road · 35 min drive');
});

it('reports an incomplete API response as a load failure instead of claiming nothing was computed', async () => {
  warehouseService.getById.mockResolvedValueOnce({ id: 1 });
  render(<WarehouseProximityFields warehouse={{ id: 1 }} />);
  expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  expect(screen.queryByText('Not computed yet')).not.toBeInTheDocument();
});

it('cancels a pending read when the section closes', () => {
  warehouseService.getById.mockReturnValueOnce(new Promise(() => {}));
  const { unmount } = render(<WarehouseProximityFields warehouse={{ id: 1 }} />);
  const signal = warehouseService.getById.mock.calls[0][1].signal;
  unmount();
  expect(signal.aborted).toBe(true);
});

it('lets a failed saved-data lookup retry without treating the error as an empty result', async () => {
  warehouseService.getById.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ WarehouseProximity: [airport] });
  render(<WarehouseProximityFields warehouse={{ id: 1 }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  expect(await screen.findByText(/Bengaluru Airport/)).toBeInTheDocument();
});

it('does not fetch for unpromoted submissions and recognises stale location measurements', () => {
  const { rerender } = render(<WarehouseProximityFields warehouse={{ id: 'staged-uuid' }} />);
  expect(screen.getAllByText('Not computed yet')).toHaveLength(10);
  expect(warehouseService.getById).not.toHaveBeenCalled();
  rerender(<WarehouseProximityFields warehouse={{ id: 1, WarehouseProximity: [
    { ...airport, computedFromLat: 12.97, computedFromLng: 77.59 },
  ] }} coordinates={{ latitude: '12.98', longitude: '77.59' }} />);
  expect(screen.getByText('Awaiting recalculation for this location')).toBeInTheDocument();
  expect(screen.queryByText(/24.6 km/)).not.toBeInTheDocument();
});
