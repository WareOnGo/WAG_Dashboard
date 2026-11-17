import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/testUtils';
import AuthContext from '../../contexts/AuthContext';
import MobileHeader from '../MobileHeader';
import { warehouseService } from '../../services/warehouseService';

vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: false }) }));
vi.mock('../../services/warehouseService', () => ({ warehouseService: { getByIds: vi.fn(), getContactNumber: vi.fn() } }));
vi.mock('../PptConfigModal', () => ({ default: ({ open, allWarehouses }) => open
  ? <div role="dialog" aria-label="Presentation preview">{allWarehouses?.map(w => <span key={w.id}>{w.address}</span>)}</div> : null }));
vi.mock('../RevealReasonModal', () => ({ default: ({ open, onConfirm }) => open
  ? <button onClick={() => onConfirm('Site visit')}>Reveal itinerary contacts</button> : null }));

const all = { email: 'user@wareongo.com', capabilities: { DASHBOARD: true, WAREHOUSE_VIEW_OWN: true, WAREHOUSE_VIEW_ALL: true } };
const own = { ...all, capabilities: { ...all.capabilities, WAREHOUSE_VIEW_ALL: false } };
const foreign = { id: 124, uploadedBy: 'colleague@wareongo.com', address: 'Restricted warehouse address', city: 'Indore' };
const element = user => <AuthContext.Provider value={{ user, logout: vi.fn() }}><MobileHeader /></AuthContext.Provider>;
const open = () => renderWithProviders(element(all), { mobileTools: true });
const submitPpt = () => {
  fireEvent.click(screen.getByRole('link', { name: /PPT Generator/ }));
  fireEvent.change(screen.getByLabelText('Warehouse IDs (comma-separated)'), { target: { value: '124' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
};
beforeEach(() => {
  vi.clearAllMocks();
  warehouseService.getByIds.mockReset();
  warehouseService.getContactNumber.mockReset();
});

it('hides export tools when warehouse viewing is unavailable', () => {
  renderWithProviders(element({ ...all, capabilities: { DASHBOARD: true } }), { mobileTools: true });
  expect(screen.queryByRole('link', { name: /PPT Generator/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Itinerary/ })).not.toBeInTheDocument();
});

it('clears a loaded presentation preview when all access becomes own access', async () => {
  warehouseService.getByIds.mockResolvedValue([foreign]);
  const view = open();
  submitPpt();
  expect(await screen.findByText(foreign.address)).toBeInTheDocument();
  view.rerender(element(own));
  expect(screen.queryByText(foreign.address)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('discards a pending warehouse response even if access changes away and back', async () => {
  let complete;
  warehouseService.getByIds.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const view = open();
  submitPpt();
  await waitFor(() => expect(warehouseService.getByIds).toHaveBeenCalled());
  view.rerender(element(own));
  view.rerender(element(all));
  await act(async () => complete([foreign]));
  expect(screen.queryByText(foreign.address)).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('does not recreate an itinerary from contact responses after a scope downgrade', async () => {
  let complete;
  warehouseService.getByIds.mockResolvedValue([foreign]);
  warehouseService.getContactNumber.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const view = open();
  fireEvent.click(screen.getByRole('link', { name: /Itinerary/ }));
  fireEvent.change(screen.getByLabelText('Warehouse IDs (comma-separated)'), { target: { value: '124' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reveal itinerary contacts' }));
  await waitFor(() => expect(warehouseService.getContactNumber).toHaveBeenCalled());
  view.rerender(element(own));
  await act(async () => complete({ contactNumber: '919800000001' }));
  expect(screen.queryByRole('dialog', { name: 'Visit Itinerary' })).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue(/Restricted warehouse address/)).not.toBeInTheDocument();
});
