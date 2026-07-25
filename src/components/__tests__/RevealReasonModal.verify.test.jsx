import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RevealReasonModal from '../RevealReasonModal';

// These render for real (jsdom). The bug this replaces was antd's static Modal.confirm
// silently no-opping under React 19, which only an actual render can catch.

const setup = (props = {}) => {
  const onConfirm = vi.fn().mockResolvedValue();
  const onCancel = vi.fn();
  const utils = render(
    <RevealReasonModal open onCancel={onCancel} onConfirm={onConfirm} {...props} />
  );
  return { onConfirm, onCancel, ...utils };
};

describe('RevealReasonModal', () => {
  it('actually renders when open (the React 19 static-modal regression)', () => {
    setup();
    expect(screen.getByText('Reveal contact number')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason for revealing')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(<RevealReasonModal open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByText('Reveal contact number')).not.toBeInTheDocument();
  });

  it('blocks an empty reason and shows why, without calling onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    expect(await screen.findByText(/which deal this is for/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocks a whitespace-only reason', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(screen.getByLabelText('Reason for revealing'), '   ');
    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    expect(await screen.findByText(/which deal this is for/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('submits a trimmed reason', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(screen.getByLabelText('Reason for revealing'), '  Flipkart Bhiwandi deal  ');
    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Flipkart Bhiwandi deal'));
  });

  it('asks once for a whole itinerary and reveals all of them under one reason', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup({ count: 5 });

    expect(screen.getByText('Reveal 5 contact numbers')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Reason for revealing'), 'Site visit route for Amazon');
    await user.click(screen.getByRole('button', { name: 'Reveal 5 numbers' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('Site visit route for Amazon');
  });

  it('keeps the typed reason and shows the error when the reveal fails', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Access forbidden'));
    render(<RevealReasonModal open count={1} onCancel={vi.fn()} onConfirm={onConfirm} />);

    const box = screen.getByLabelText('Reason for revealing');
    await user.type(box, 'Godrej deal');
    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    expect(await screen.findByText('Access forbidden')).toBeInTheDocument();
    expect(box).toHaveValue('Godrej deal');
  });

  it('cancels without revealing', async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('caps input at the length the backend accepts', () => {
    setup();
    expect(screen.getByLabelText('Reason for revealing')).toHaveAttribute('maxlength', '280');
  });

  it('submits on Enter so a short deal name needs no mouse trip', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    await user.type(screen.getByLabelText('Reason for revealing'), 'Godrej Chakan{Enter}');

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Godrej Chakan'));
  });

  it('keeps Shift+Enter for a newline instead of submitting', async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    const box = screen.getByLabelText('Reason for revealing');
    await user.type(box, 'Godrej Chakan{Shift>}{Enter}{/Shift}plus warehouse 12');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(box.value).toContain('\n');
  });

  it('shows the audit notice by default and swaps it for the error in place', async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.getByText(/Saved to the audit log with your name/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal number' }));

    // Error takes the notice's place rather than stacking below it.
    expect(await screen.findByText(/which deal this is for/i)).toBeInTheDocument();
    expect(screen.queryByText(/Saved to the audit log/i)).not.toBeInTheDocument();
  });

  it('tells the user it covers the whole itinerary', () => {
    setup({ count: 4 });
    expect(screen.getByText(/for all 4 numbers/i)).toBeInTheDocument();
  });

  it('only counts down near the limit', async () => {
    const user = userEvent.setup();
    setup();
    const box = screen.getByLabelText('Reason for revealing');

    await user.type(box, 'short reason');
    expect(screen.queryByText(/left$/)).not.toBeInTheDocument();

    await user.clear(box);
    await user.type(box, 'x'.repeat(250));
    expect(screen.getByText('30 left')).toBeInTheDocument();
  });
});
