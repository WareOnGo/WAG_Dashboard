import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout, ConfigProvider, theme, App as AntApp } from 'antd'
import { Dashboard, ErrorBoundary, MobileHeader, MobileNavigation, ProtectedRoute, SignInScreen } from './components'
import { AboveFoldOptimizer } from './components/CriticalContentLoader'
import { CompatibilityProvider } from './components/CompatibilityProvider'
import AuthErrorBoundary from './components/AuthErrorBoundary'
import AuthCallback from './components/AuthCallback'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useViewport } from './hooks'
import { useState, useEffect } from 'react'
import performanceService from './services/performanceService'
import './App.css'
import './styles/compatibility.css'

const { Content } = Layout

/**
 * Main App Content Component
 * Handles authenticated app routing and layout
 */
function AppContent() {
  const { isMobile } = useViewport();
  const { isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [appReady, setAppReady] = useState(false);

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
        backgroundColor: '#141414',
        color: 'white'
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
    <Router>
      <Routes>
        {/* OAuth callback route - accessible without authentication */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Sign in route */}
        <Route path="/" element={
          !isAuthenticated ? (
            <AuthErrorBoundary>
              <SignInScreen />
            </AuthErrorBoundary>
          ) : (
            <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-top safe-area-bottom">
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
                  <Dashboard />
                </ProtectedRoute>
              </Content>
            </Layout>
          )
        } />
        
        {/* Dashboard route */}
        <Route path="/dashboard" element={
          <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} className="safe-area-top safe-area-bottom">
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
                <Dashboard />
              </ProtectedRoute>
            </Content>
          </Layout>
        } />
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <CompatibilityProvider>
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: {
              // Dark theme configuration
              colorBgContainer: '#1f1f1f',
              colorBgElevated: '#262626',
              colorBorder: '#303030',
              colorText: 'rgba(255, 255, 255, 0.85)',
              colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
              colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
              colorPrimary: '#1890ff',
              colorSuccess: '#52c41a',
              colorWarning: '#faad14',
              colorError: '#ff4d4f',
              colorInfo: '#1890ff',
              // Layout colors
              colorBgLayout: '#141414',
              colorBgHeader: '#1f1f1f',
              // Component specific colors
              colorBgMask: 'rgba(0, 0, 0, 0.45)',
              borderRadius: 6,
              boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            },
          }}
        >
          <AntApp>
            <AboveFoldOptimizer>
              <AuthErrorBoundary>
                <AuthProvider>
                  <AppContent />
                </AuthProvider>
              </AuthErrorBoundary>
            </AboveFoldOptimizer>
          </AntApp>
        </ConfigProvider>
      </CompatibilityProvider>
    </ErrorBoundary>
  )
}

export default App
