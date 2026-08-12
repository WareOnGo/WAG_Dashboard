import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Exercises the real itinerary flow that broke: click Generate -> one reason prompt for
// the whole list -> every number fetched under that single reason.

const getByIds = vi.fn();
const getContactNumber = vi.fn();

vi.mock('../../services/warehouseService', () => ({
  warehouseService: {
    getByIds: (...a) => getByIds(...a),
    getContactNumber: (...a) => getContactNumber(...a),
  },
}));

vi.mock('../../hooks', () => ({ useViewport: () => ({ isMobile: false }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Test User', email: 't@wareongo.com' }, logout: vi.fn() }),
}));
vi.mock('../../services/pptService', () => ({
  generateDetailedPpt: vi.fn(), generatePptV2: vi.fn(),
  generateGodamwalePpt: vi.fn(), generateTciPpt: vi.fn(),
}));

const MobileHeader = (await import('../MobileHeader')).default;
// Real provider, not a mock: the itinerary bar's open-state lives in this context, so a
// stubbed setter would make the Generate button unreachable.
const { MobileToolsProvider } = await import('../../contexts/MobileToolsContext');

const renderHeader = () =>
  render(
    <MobileToolsProvider>
      <MobileHeader onMenuToggle={vi.fn()} />
    </MobileToolsProvider>
  );

const WAREHOUSES = [
  { id: 1, name: 'WH One', city: 'Bhiwandi', totalSpaceSqft: 40000 },
  { id: 5, name: 'WH Five', city: 'Hosur', totalSpaceSqft: 25000 },
  { id: 12, name: 'WH Twelve', city: 'Bhiwandi', totalSpaceSqft: 60000 },
];

// The Generate control lives behind the navbar's "Itinerary" toggle.
const openItineraryBar = async (user) => {
  await user.click(screen.getByRole('link', { name: /Itinerary/i }));
  return screen.getByRole('button', { name: 'Generate' });
};

describe('itinerary reason flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByIds.mockResolvedValue(WAREHOUSES);
    getContactNumber.mockImplementation((id) =>
      Promise.resolve({ contactNumber: `+9198765432${String(id).padStart(2, '0')}` })
    );
  });

  it('prompts once for 3 warehouses and reveals none before a reason is given', async () => {
    const user = userEvent.setup();
    renderHeader();

    const generate = await openItineraryBar(user);
    await user.type(screen.getByPlaceholderText(/Warehouse IDs/i), '1, 5, 12');
    await user.click(generate);

    // One prompt covering all three...
    expect(await screen.findByText('Reveal 3 contact numbers')).toBeInTheDocument();
    // ...and nothing revealed until it's answered.
    expect(getContactNumber).not.toHaveBeenCalled();
  });

  it('fetches every number under the one reason and shows the itinerary', async () => {
    const user = userEvent.setup();
    renderHeader();

    const generate = await openItineraryBar(user);
    await user.type(screen.getByPlaceholderText(/Warehouse IDs/i), '1, 5, 12');
    await user.click(generate);

    await user.type(
      await screen.findByLabelText('Reason for revealing'),
      'Flipkart Bhiwandi site visit'
    );
    await user.click(screen.getByRole('button', { name: 'Reveal 3 numbers' }));

    await waitFor(() => expect(getContactNumber).toHaveBeenCalledTimes(3));

    // Same reason on all three reveals — one prompt, not one per warehouse.
    expect(getContactNumber.mock.calls.map(c => c[0])).toEqual([1, 5, 12]);
    for (const call of getContactNumber.mock.calls) {
      expect(call[1]).toBe('Flipkart Bhiwandi site visit');
    }

    // The result modal opens with the revealed numbers in it.
    expect(await screen.findByText('Visit Itinerary')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByDisplayValue(/\+919876543201/)).toBeInTheDocument()
    );
  });

  it('reveals nothing if the user cancels the prompt', async () => {
    const user = userEvent.setup();
    renderHeader();

    const generate = await openItineraryBar(user);
    await user.type(screen.getByPlaceholderText(/Warehouse IDs/i), '1, 5');
    await user.click(generate);

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(getContactNumber).not.toHaveBeenCalled();
    expect(screen.queryByText('Visit Itinerary')).not.toBeInTheDocument();
  });

  it('never prompts when no warehouses resolve', async () => {
    getByIds.mockResolvedValue([]);
    const user = userEvent.setup();
    renderHeader();

    const generate = await openItineraryBar(user);
    await user.type(screen.getByPlaceholderText(/Warehouse IDs/i), '999');
    await user.click(generate);

    await waitFor(() => expect(getByIds).toHaveBeenCalled());
    expect(screen.queryByLabelText('Reason for revealing')).not.toBeInTheDocument();
    expect(getContactNumber).not.toHaveBeenCalled();
  });
});
