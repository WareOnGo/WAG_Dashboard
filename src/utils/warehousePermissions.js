// Keep the dependency graph aligned with Backend_Repository's permission policy.
export const WAREHOUSE_PERMISSIONS = [
  { key: 'viewOwnWarehouseEntries', label: 'View own warehouse entries', hint: 'View entries uploaded with this employee’s email' },
  { key: 'editOwnWarehouseEntries', label: 'Edit own warehouse entries', hint: 'Create and edit own entries, plus the Availability section on other viewable entries; requires View own' },
  { key: 'viewAllWarehouseEntries', label: 'View all warehouse entries', hint: 'View entries from every employee; requires View own' },
  { key: 'editAllWarehouseEntries', label: 'Edit all warehouse entries', hint: 'Edit entries from every employee; requires Edit own and View all' },
]

const DEPENDENCIES = {
  dashboardAccess: [],
  viewOwnWarehouseEntries: ['dashboardAccess'],
  editOwnWarehouseEntries: ['viewOwnWarehouseEntries'],
  viewAllWarehouseEntries: ['viewOwnWarehouseEntries'],
  editAllWarehouseEntries: ['editOwnWarehouseEntries', 'viewAllWarehouseEntries'],
}

export function effectiveWarehousePermissions(row = {}) {
  const result = {}
  for (const [key, parents] of Object.entries(DEPENDENCIES)) {
    result[key] = row[key] === true && parents.every(parent => result[parent])
  }
  return result
}

export function canViewWarehouses(user) {
  return !!(user?.isAdmin || (user?.capabilities?.DASHBOARD && user.capabilities.WAREHOUSE_VIEW_OWN))
}

export function canCreateWarehouse(user) {
  return !!(canViewWarehouses(user) && (user?.isAdmin || user?.capabilities?.WAREHOUSE_EDIT_OWN))
}

export function canEditWarehouse(user, warehouse) {
  if (!canCreateWarehouse(user)) return false
  if (user?.isAdmin || (user?.capabilities?.WAREHOUSE_VIEW_ALL && user?.capabilities?.WAREHOUSE_EDIT_ALL)) return true
  return !!user?.email && typeof warehouse?.uploadedBy === 'string'
    && warehouse.uploadedBy.toLowerCase() === user.email.trim().toLowerCase()
}

// Keep full-record edit checks for visibility, visit notes, media, etc. The
// shared Availability section does not expand the employee's view scope.
export function canEditWarehouseAvailability(user, warehouse) {
  return canCreateWarehouse(user) && !!warehouse
    && (canEditWarehouse(user, warehouse) || !!user?.capabilities?.WAREHOUSE_VIEW_ALL)
}

// Aligned with the backend's Availability update allowlist.
export const AVAILABILITY_FIELDS = [
  'availability', 'availabilityLastReviewedOn', 'handoverType', 'handoverDate',
  'handoverLeadValue', 'handoverLeadUnit', 'lockInDate', 'status',
]

// Changing view scope invalidates previously loaded rows and map details.
export const warehouseAccessKey = user => [
  user?.email || '', canViewWarehouses(user), !!user?.isAdmin, !!user?.capabilities?.WAREHOUSE_VIEW_ALL,
].join(':')
