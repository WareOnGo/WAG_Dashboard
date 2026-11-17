import { expect, it } from 'vitest'
import { canViewWarehouses, canCreateWarehouse, canEditWarehouse } from './warehousePermissions'
const user = { email: 'user@wareongo.com', capabilities: { DASHBOARD: true, WAREHOUSE_VIEW_OWN: true, WAREHOUSE_EDIT_OWN: true } }

it('own edit uses exact case-insensitive email identity', () => {
  expect(canEditWarehouse(user, { uploadedBy: 'USER@wareongo.com' })).toBe(true)
  for (const uploadedBy of ['other@wareongo.com', 'prefix-user@wareongo.com', 'User', '', undefined]) {
    expect(canEditWarehouse(user, { uploadedBy })).toBe(false)
  }
})
it('view all alone never permits editing other employees’ entries', () => {
  expect(canEditWarehouse({ ...user, capabilities: { ...user.capabilities, WAREHOUSE_VIEW_ALL: true } }, { uploadedBy: 'other@wareongo.com' })).toBe(false)
  expect(canEditWarehouse({ ...user, capabilities: { ...user.capabilities, WAREHOUSE_VIEW_ALL: true, WAREHOUSE_EDIT_ALL: true } }, { uploadedBy: 'other@wareongo.com' })).toBe(true)
})
it('read-only and missing capabilities hide creation and editing', () => {
  const reader = { ...user, capabilities: { DASHBOARD: true, WAREHOUSE_VIEW_OWN: true } }
  expect(canViewWarehouses(reader)).toBe(true)
  expect(canCreateWarehouse(reader)).toBe(false)
  for (const session of [null, {}, { capabilities: { DASHBOARD: true } }, { ...user, capabilities: { ...user.capabilities, DASHBOARD: false } }]) {
    expect(canViewWarehouses(session)).toBe(false)
    expect(canCreateWarehouse(session)).toBe(false)
    expect(canEditWarehouse(session, { uploadedBy: user.email })).toBe(false)
  }
})
it('admins inherit all warehouse grants', () => {
  expect(canCreateWarehouse({ isAdmin: true })).toBe(true)
  expect(canEditWarehouse({ isAdmin: true }, { uploadedBy: 'anyone' })).toBe(true)
})
