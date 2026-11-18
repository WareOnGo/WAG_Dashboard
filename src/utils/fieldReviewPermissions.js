import { warehouseAccessKey } from './warehousePermissions';

export const canManageFieldReviews = user => !!(user?.isAdmin || user?.isReviewer);

// Every review surface invalidates its data when identity, warehouse scope,
// response permissions or reviewer access changes.
export const fieldReviewAccessKey = user => [
  warehouseAccessKey(user), canManageFieldReviews(user),
  !!user?.capabilities?.WAREHOUSE_EDIT_OWN, !!user?.capabilities?.WAREHOUSE_EDIT_ALL,
].join(':');

// The list owner stamps the authorization scope captured when it requested the
// rows. Never reuse a bundled review link or note under a different session.
export const embeddedFieldReview = (warehouse, accessKey) =>
  warehouse?._fieldReviewAccessKey === accessKey ? warehouse.fieldReviewSummary : undefined;
