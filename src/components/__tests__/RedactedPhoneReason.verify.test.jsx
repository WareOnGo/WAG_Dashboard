import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getContactNumber = vi.fn();

vi.mock('../../services/warehouseService', () => ({
  warehouseService: { getContactNumber: (...a) => getContactNumber(...a) },
}));
vi.mock('../../hooks', () => ({ useViewport: () => ({ isMobile: false }) }));

const RedactedPhone = (await import('../RedactedPhone')).default;

describe('RedactedPhone reason gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getContactNumber.mockResolvedValue({ contactNumber: '+919876543210' });
  });

  it('asks for a reason before fetching, then reveals the number', async () => {
    const user = userEvent.setup();
    render(<RedactedPhone warehouseId={42} />);

    await user.click(screen.getByRole('button', { name: /Show Number/i }));

    // Prompt is up and nothing has been fetched yet.
    expect(await screen.findByText('Reveal contact number')).toBeInTheDocument();
    expect(getContactNumber).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Reason for revealing'), 'Godrej Chakan deal');
    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    await waitFor(() => expect(getContactNumber).toHaveBeenCalledWith(42, 'Godrej Chakan deal'));
    expect(await screen.findByText('+919876543210')).toBeInTheDocument();
  });

  it('reveals nothing when the prompt is cancelled', async () => {
    const user = userEvent.setup();
    render(<RedactedPhone warehouseId={42} />);

    await user.click(screen.getByRole('button', { name: /Show Number/i }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(getContactNumber).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Show Number/i })).toBeInTheDocument();
  });

  it('surfaces a failed reveal in the prompt instead of dying silently', async () => {
    getContactNumber.mockRejectedValue(new Error('Query parameters validation failed'));
    const user = userEvent.setup();
    render(<RedactedPhone warehouseId={42} />);

    await user.click(screen.getByRole('button', { name: /Show Number/i }));
    await user.type(await screen.findByLabelText('Reason for revealing'), 'Some deal');
    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    expect(await screen.findByText('Query parameters validation failed')).toBeInTheDocument();
  });

  it('skips the prompt for an inline number — no API call to audit', async () => {
    const user = userEvent.setup();
    render(<RedactedPhone warehouseId="staged-uuid" contactNumber="+918888877777" />);

    await user.click(screen.getByRole('button', { name: /Show Number/i }));

    expect(await screen.findByText('+918888877777')).toBeInTheDocument();
    expect(screen.queryByText('Reveal contact number')).not.toBeInTheDocument();
    expect(getContactNumber).not.toHaveBeenCalled();
  });
});
