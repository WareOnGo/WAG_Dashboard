import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import MobileHeader from '../MobileHeader';
import { useViewport } from '../../hooks/useViewport';

vi.mock('../../hooks/useViewport', () => ({ useViewport: vi.fn() }));
const auth = { user: { name: 'Employee', email: 'employee@wareongo.com' }, logout: vi.fn() };
const open = () => {
  const onMenuToggle = vi.fn();
  return { onMenuToggle, ...renderWithProviders(<MobileHeader onMenuToggle={onMenuToggle} />, { auth, mobileTools: true }) };
};
beforeEach(() => { vi.clearAllMocks(); useViewport.mockReturnValue({ isMobile: false }); });

describe('current header navigation', () => {
  it('opens the mobile menu from the hamburger button', async () => {
    useViewport.mockReturnValue({ isMobile: true });
    const { onMenuToggle } = open();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
    expect(onMenuToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'WareOnGo' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: /PPT Generator/ })).not.toBeInTheDocument();
  });

  it('renders desktop tools without a hamburger control', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Toggle navigation menu' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /PPT Generator/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Itinerary/ })).toBeInTheDocument();
  });

  it('opens and closes the desktop itinerary input', async () => {
    open();
    const toggle = screen.getByRole('link', { name: /Itinerary/ });
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Generate' })).not.toBeInTheDocument();
  });

  it('opens and closes the desktop PPT input', async () => {
    open();
    const toggle = screen.getByRole('link', { name: /PPT Generator/ });
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });
});
