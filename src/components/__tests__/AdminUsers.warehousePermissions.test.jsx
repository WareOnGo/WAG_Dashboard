import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import AdminUsers from '../AdminUsers'
import { verifiedNumberService } from '../../services/verifiedNumberService'

const state = vi.hoisted(() => ({ mobile: false, message: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, modal: { confirm: vi.fn() } }))
vi.mock('../../contexts', () => ({ useAuth: () => ({ user: { isAdmin: true, email: 'admin@wareongo.com' } }) }))
vi.mock('../../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: state.mobile }) }))
vi.mock('antd', async original => ({ ...await original(), App: { useApp: () => ({ message: state.message, modal: state.modal }) } }))
vi.mock('../../services/verifiedNumberService', () => ({ verifiedNumberService: { adminList: vi.fn(), adminUpdate: vi.fn() } }))
const employee = {
  id: 2, name: 'Colleague', email: 'colleague@wareongo.com', is_active: true, dashboardAccess: true,
  viewOwnWarehouseEntries: true, editOwnWarehouseEntries: true,
  viewAllWarehouseEntries: true, editAllWarehouseEntries: true,
}
const toggle = label => screen.getByLabelText(`${label} for Colleague`)
beforeEach(() => { vi.clearAllMocks(); state.mobile = false; verifiedNumberService.adminList.mockResolvedValue([employee]) })

it.each([false, true])('nests the four switches under Dashboard on mobile=%s and displays server cascades', async mobile => {
  state.mobile = mobile
  render(<AdminUsers />)
  const group = await screen.findByRole('group', { name: 'Warehouse permissions for Colleague' })
  expect(within(group).getAllByRole('switch')).toHaveLength(4)
  const saved = { ...employee, viewOwnWarehouseEntries: false, editOwnWarehouseEntries: false, viewAllWarehouseEntries: false, editAllWarehouseEntries: false }
  verifiedNumberService.adminUpdate.mockResolvedValue(saved)
  fireEvent.click(toggle('View own warehouse entries'))
  await waitFor(() => expect(verifiedNumberService.adminUpdate).toHaveBeenCalledWith(2, { viewOwnWarehouseEntries: false }))
  await waitFor(() => expect(within(group).getAllByRole('switch').every(el => el.getAttribute('aria-checked') === 'false')).toBe(true))
  expect(toggle('Dashboard')).toHaveAttribute('aria-checked', 'true')
  // Enabling Edit all lets the server enable all prerequisites atomically.
  verifiedNumberService.adminUpdate.mockResolvedValue(employee)
  fireEvent.click(toggle('Edit all warehouse entries'))
  await waitFor(() => expect(verifiedNumberService.adminUpdate).toHaveBeenLastCalledWith(2, { editAllWarehouseEntries: true }))
  await waitFor(() => expect(within(group).getAllByRole('switch').every(el => el.getAttribute('aria-checked') === 'true')).toBe(true))
})

it('Dashboard off disables all children; reenabling does not restore grants', async () => {
  render(<AdminUsers />)
  await screen.findByRole('group')
  const revoked = { ...employee, dashboardAccess: false, viewOwnWarehouseEntries: false, editOwnWarehouseEntries: false, viewAllWarehouseEntries: false, editAllWarehouseEntries: false }
  verifiedNumberService.adminUpdate.mockResolvedValue(revoked)
  fireEvent.click(toggle('Dashboard'))
  await waitFor(() => expect(toggle('View own warehouse entries')).toBeDisabled())
  verifiedNumberService.adminUpdate.mockResolvedValue({ ...revoked, dashboardAccess: true })
  fireEvent.click(toggle('Dashboard'))
  await waitFor(() => expect(toggle('View own warehouse entries')).toBeEnabled())
  expect(toggle('View all warehouse entries')).toHaveAttribute('aria-checked', 'false')
})

it('keeps saved permissions after a rejected update and disables every switch during a save', async () => {
  let reject
  verifiedNumberService.adminUpdate.mockReturnValue(new Promise((_, rejectRequest) => { reject = rejectRequest }))
  render(<AdminUsers />)
  await screen.findByRole('group')
  fireEvent.click(toggle('Edit own warehouse entries'))
  expect(toggle('View all warehouse entries')).toBeDisabled()
  reject(new Error('Save failed'))
  await waitFor(() => expect(state.message.error).toHaveBeenCalled())
  expect(toggle('Edit own warehouse entries')).toHaveAttribute('aria-checked', 'true')
  expect(toggle('Edit all warehouse entries')).toHaveAttribute('aria-checked', 'true')
})

it.each([{ adminAccess: true }, { environmentAdmin: true }])('shows inherited grants for admins: %j', async grant => {
  verifiedNumberService.adminList.mockResolvedValue([{ ...employee, ...grant }])
  render(<AdminUsers />)
  const group = await screen.findByRole('group')
  expect(within(group).queryByRole('switch')).not.toBeInTheDocument()
  expect(within(group).getAllByText('via admin')).toHaveLength(4)
})

it('disables warehouse controls for inactive employees', async () => {
  verifiedNumberService.adminList.mockResolvedValue([{ ...employee, is_active: false }])
  render(<AdminUsers />)
  const group = await screen.findByRole('group')
  within(group).getAllByRole('switch').forEach(el => expect(el).toBeDisabled())
})
