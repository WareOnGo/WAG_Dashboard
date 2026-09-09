import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/testUtils';
import MobileHeader from '../MobileHeader';
import MobileNavigation from '../MobileNavigation';

vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: true }) }));
const auth = { user: { name: 'Employee', email: 'employee@wareongo.com' }, logout: vi.fn() };
function HeaderAndDrawer() {
  const [visible, setVisible] = useState(false);
  return <>
    <MobileHeader onMenuToggle={() => setVisible(true)} />
    <MobileNavigation visible={visible} onClose={() => setVisible(false)} />
  </>;
}
beforeEach(() => { vi.clearAllMocks(); });

describe('mobile tools shared between the header and drawer', () => {
  it.each([
    ['PPT Generator', 'Warehouse IDs for PPT (e.g. 1, 5, 12)', 'Close PPT generator'],
    ['Itinerary', 'Warehouse IDs (e.g. 1, 5, 12)', 'Close itinerary'],
  ])('opens %s from the drawer and closes it from the header', async (tool, placeholder, closeLabel) => {
    renderWithProviders(<HeaderAndDrawer />, { auth, mobileTools: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
    await user.click(await screen.findByRole('menuitem', { name: new RegExp(tool) }));
    expect(await screen.findByPlaceholderText(placeholder)).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: closeLabel }));
    expect(screen.queryByPlaceholderText(placeholder)).not.toBeInTheDocument();
  });
});
