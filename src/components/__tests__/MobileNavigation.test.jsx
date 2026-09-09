import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import MobileNavigation from '../MobileNavigation';
import { useViewport } from '../../hooks/useViewport';

vi.mock('../../hooks/useViewport', () => ({ useViewport: vi.fn() }));
const open = (user = {}, props = {}) => {
  const onClose = vi.fn();
  const logout = vi.fn().mockResolvedValue(undefined);
  const view = renderWithProviders(<MobileNavigation visible onClose={onClose} {...props} />, {
    auth: { user: { name: 'Employee', email: 'employee@wareongo.com', ...user }, logout }, mobileTools: true,
  });
  return { ...view, onClose, logout };
};
beforeEach(() => { vi.clearAllMocks(); useViewport.mockReturnValue({ isMobile: true }); });

describe('current mobile navigation', () => {
  it.each([
    [{}, false, false],
    [{ isReviewer: true }, true, false],
    [{ isAdmin: true }, true, true],
  ])('shows only the role-appropriate links for %j', async (user, canReview, canAdmin) => {
    await act(async () => { open(user); });
    expect(screen.getByRole('menuitem', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /GIS/ })).toBeInTheDocument();
    expect(Boolean(screen.queryByRole('menuitem', { name: /Review Queue/ }))).toBe(canReview);
    expect(Boolean(screen.queryByRole('menuitem', { name: /Micro-Markets/ }))).toBe(canReview);
    expect(Boolean(screen.queryByRole('menuitem', { name: /Admin Panel/ }))).toBe(canAdmin);
  });

  it('closes from the named close button', async () => {
    const { onClose } = open();
    await userEvent.click(screen.getByRole('button', { name: 'Close navigation menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and releases its scroll lock when unmounted', () => {
    const { onClose, unmount } = open();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('requests closure when the viewport changes to desktop', async () => {
    const { onClose, rerender } = open();
    useViewport.mockReturnValue({ isMobile: false });
    await act(async () => { rerender(<MobileNavigation visible onClose={onClose} />); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('logs out before closing the drawer', async () => {
    const { logout, onClose } = open();
    await userEvent.click(screen.getByRole('button', { name: /Logout|Log out|Sign out/i }));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
