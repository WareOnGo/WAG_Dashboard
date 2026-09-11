import { BrowserRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { Layout, App as AntApp, Spin } from 'antd'
// Import shell components directly (not via the ./components barrel) so the initial
// bundle isn't forced to pull the whole barrel graph.
import ErrorBoundary from './components/ErrorBoundary'
import MobileHeader from './components/MobileHeader'
import MobileNavigation from './components/MobileNavigation'
import ProtectedRoute from './components/ProtectedRoute'
import SignInScreen from './components/SignInScreen'
import { AboveFoldOptimizer } from './components/CriticalContentLoader'
import { CompatibilityProvider } from './components/CompatibilityProvider'
import AuthErrorBoundary from './components/AuthErrorBoundary'
import AuthCallback from './components/AuthCallback'
import SessionExpired from './components/SessionExpired'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MobileToolsProvider } from './contexts/MobileToolsContext'
import { useViewport } from './hooks'
import { useTokenExpiryWatcher } from './hooks/useTokenExpiryWatcher'
import { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react'
import performanceService from './services/performanceService'
import ProductTheme from './ProductTheme'
import './App.css'
import './styles/compatibility.css'
import './styles/dashboard-mobile.css'

const { Content } = Layout

// Route-level code-splitting: Dashboard pulls in the heavy warehouse UI and ReviewQueue
// is admin-only, so neither needs to be in the initial (sign-in) bundle.
const Dashboard = lazy(() => import('./components/Dashboard'))
const ReviewQueue = lazy(() => import('./components/ReviewQueue'))
const MicroMarkets = lazy(() => import('./components/MicroMarkets'))
const AdminUsers = lazy(() => import('./components/AdminUsers'))
// Pulls in mapbox-gl (~1MB), so lazy like the other map-bearing routes.
const GeoExplorer = lazy(() => import('./components/GeoExplorer'))

const RouteFallback = () => (
  <div role="status" aria-label="Loading page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: 'var(--bg-primary, #16161e)' }}>
    <Spin size="large" />
  </div>
)

// Keep navigation visible while only the requested page's code is loading.
const PageContent = ({ children }) => (
  <Suspense fallback={<RouteFallback />}>{children}</Suspense>
)

/**
 * Main App Content Component
 * Handles authenticated app routing and layout
 */
function AppContent() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  const { isMobile } = useViewport();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);

  // New page links start at the top; back/forward retain browser scroll restoration.
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, navigationType]);

  // Proactively watch for token expiry and redirect when session ends
  useTokenExpiryWatcher({ isAuthenticated, logout });

  // Initialize performance optimizations
  useEffect(() => {
    const initializeApp = async () => {
      // Measure app initialization time
      await performanceService.measureResponseTime('app_initialization', async () => {
        // Prioritize critical content loading
        await performanceService.prioritizeAboveFold();
        
        // Additional mobile optimizations
        if (isMobile) {
          // Preload critical resources
          performanceService.preloadCriticalResources();
        }
        
        return true;
      });
      
      setAppReady(true);
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      performanceService.cleanup();
    };
  }, [isMobile]);

  const handleMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMenuClose = () => {
    setMobileMenuOpen(false);
  };

  // Show loading state while authentication is being checked or app initializes
  if (isLoading || (!appReady && isMobile)) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary, #16161e)',
        color: 'var(--text-primary, #c0caf5)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>🏢</div>
          <div>{isLoading ? 'Checking authentication...' : 'Loading Warehouse Portal...'}</div>
        </div>
      </div>
    );
  }

  // Main app with router (includes both auth and non-auth routes)
  return (
    <MobileToolsProvider>

      <Routes>
        {/* OAuth callback route - accessible without authentication */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Session expired route - shown after automatic sign-out */}
        <Route path="/session-expired" element={<SessionExpired />} />
        
        {/* Sign in route */}
        <Route path="/" element={
          !isAuthenticated ? (
            <AuthErrorBoundary>
              <SignInScreen />
            </AuthErrorBoundary>
          ) : (
            <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-bottom">
              <MobileHeader 
                onMenuToggle={handleMenuToggle}
                isMenuOpen={mobileMenuOpen}
              />
              <MobileNavigation 
                visible={mobileMenuOpen}
                onClose={handleMenuClose}
              />
              <Content style={{
                background: 'var(--bg-primary)',
                minHeight: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 56px)',
                padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
              }}>
                <ProtectedRoute>
                  <PageContent><Dashboard /></PageContent>
                </ProtectedRoute>
              </Content>
            </Layout>
          )
        } />
        
        {/* Dashboard route */}
        <Route path="/dashboard" element={
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-bottom">
            <MobileHeader 
              onMenuToggle={handleMenuToggle}
              isMenuOpen={mobileMenuOpen}
            />
            <MobileNavigation 
              visible={mobileMenuOpen}
              onClose={handleMenuClose}
            />
            <Content style={{
              background: 'var(--bg-primary)',
              minHeight: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 56px)',
              padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
            }}>
              <ProtectedRoute>
                <PageContent><Dashboard /></PageContent>
              </ProtectedRoute>
            </Content>
          </Layout>
        } />

        {/* Review queue route (admin-only; ReviewQueue renders a 403 for non-admins) */}
        <Route path="/review" element={
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-bottom">
            <MobileHeader
              onMenuToggle={handleMenuToggle}
              isMenuOpen={mobileMenuOpen}
            />
            <MobileNavigation
              visible={mobileMenuOpen}
              onClose={handleMenuClose}
            />
            <Content style={{
              background: 'var(--bg-primary)',
              minHeight: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 56px)',
              padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
            }}>
              <ProtectedRoute>
                <PageContent><ReviewQueue /></PageContent>
              </ProtectedRoute>
            </Content>
          </Layout>
        } />

        {/* Employee access admin (admin-only; AdminUsers renders a 403 for non-admins) */}
        <Route path="/admin" element={
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-bottom">
            <MobileHeader
              onMenuToggle={handleMenuToggle}
              isMenuOpen={mobileMenuOpen}
            />
            <MobileNavigation
              visible={mobileMenuOpen}
              onClose={handleMenuClose}
            />
            <Content style={{
              background: 'var(--bg-primary)',
              minHeight: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 56px)',
              padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
            }}>
              <ProtectedRoute>
                <PageContent><AdminUsers /></PageContent>
              </ProtectedRoute>
            </Content>
          </Layout>
        } />

        {/* Micro-market mapping route (reviewer-only; MicroMarkets renders a 403 for non-reviewers) */}
        <Route path="/micro-markets" element={
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-bottom">
            <MobileHeader
              onMenuToggle={handleMenuToggle}
              isMenuOpen={mobileMenuOpen}
            />
            <MobileNavigation
              visible={mobileMenuOpen}
              onClose={handleMenuClose}
            />
            <Content style={{
              background: 'var(--bg-primary)',
              minHeight: isMobile ? 'calc(100vh - 64px)' : 'calc(100vh - 56px)',
              padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
            }}>
              <ProtectedRoute>
                <PageContent><MicroMarkets /></PageContent>
              </ProtectedRoute>
            </Content>
          </Layout>
        } />
        {/* Map view: POI plotting over warehouses, OSM reference points and our own points */}
        <Route path="/map" element={
          <Layout style={{ background: 'var(--bg-primary)' }} className="geo-route">
            <MobileHeader
              onMenuToggle={handleMenuToggle}
              isMenuOpen={mobileMenuOpen}
            />
            <MobileNavigation
              visible={mobileMenuOpen}
              onClose={handleMenuClose}
            />
            {/* No padding and a fixed height, unlike the other routes: the map
                fills its pane edge to edge and manages its own internal spacing.
                height (not minHeight) so the map can size to 100% of it. */}
            <Content className="geo-route-content" style={{
              background: 'var(--bg-primary)',
              padding: 0,
              overflow: 'hidden',
              // GeoExplorer pins itself to this box. ProtectedRoute's wrapper
              // carries min-height:100vh and no positioning, so without an
              // explicit containing block the map would size against the
              // viewport and overflow by the height of the header.
              position: 'relative'
            }}>
              <ProtectedRoute>
                <PageContent><GeoExplorer /></PageContent>
              </ProtectedRoute>
            </Content>
          </Layout>
        } />
      </Routes>

    </MobileToolsProvider>
  );
}

function App() {
  return (
    <Router>
    <ErrorBoundary>
      <CompatibilityProvider>
        <ProductTheme>
          <AntApp>
            <AboveFoldOptimizer>
              <AuthErrorBoundary>
                <AuthProvider>
                  <AppContent />
                </AuthProvider>
              </AuthErrorBoundary>
            </AboveFoldOptimizer>
          </AntApp>
        </ProductTheme>
      </CompatibilityProvider>
    </ErrorBoundary>
    </Router>
  )
}

export default App
