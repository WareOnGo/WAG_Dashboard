// Components will be exported from here.
//
// NOTE: Dashboard, ReviewQueue, WarehouseForm and MapView are intentionally NOT
// re-exported from this barrel. They are heavy (Dashboard/ReviewQueue are routes,
// WarehouseForm is ~1k lines, MapView pulls in mapbox-gl ~1MB). Re-exporting them
// here would make them statically reachable from any barrel import and force them
// into the initial bundle. Import them directly / lazily instead, e.g.:
//   const Dashboard = lazy(() => import('./components/Dashboard'))
//   const MapView   = React.lazy(() => import('./MapView'))
export { default as FileUpload } from './FileUpload';
export { default as ErrorHandlingDemo } from './ErrorHandlingDemo';
export { default as ErrorBoundary } from './ErrorBoundary';
export { default as AuthErrorBoundary } from './AuthErrorBoundary';
export { default as AuthCallback } from './AuthCallback';
export { default as ContextMenu } from './ContextMenu';
export { default as MobileHeader } from './MobileHeader';
export { default as MobileNavigation } from './MobileNavigation';
export { default as ResponsiveTable } from './ResponsiveTable';
export { default as WarehouseCard } from './WarehouseCard';
export { default as CardView } from './CardView';
export { default as ViewSwitcher } from './ViewSwitcher';
export { default as MobileFilterDrawer } from './MobileFilterDrawer';
export { default as ResponsiveModal } from './ResponsiveModal';
export { default as WarehouseDetailsModal } from './WarehouseDetailsModal';
export { default as LazyImage } from './LazyImage';
export { default as CriticalContentLoader, AboveFoldOptimizer } from './CriticalContentLoader';
export { default as CompatibilityProvider } from './CompatibilityProvider';
export { default as FeatureGate } from './FeatureGate';
export { default as BrowserGate } from './BrowserGate';
export { default as DeviceGate } from './DeviceGate';
export { default as SignInScreen } from './SignInScreen';
export { default as ProtectedRoute } from './ProtectedRoute';
export { default as SessionExpired } from './SessionExpired';
export { default as PptConfigModal } from './PptConfigModal';

// Re-export hooks and utilities
export { useCompatibility } from '../hooks/useCompatibility';
export { withCompatibility } from '../utils/compatibilityUtils.jsx';