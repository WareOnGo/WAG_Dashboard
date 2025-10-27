import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout, Typography, ConfigProvider, theme, App as AntApp, Button, Space } from 'antd'
import {
  UserOutlined,
  FileTextOutlined,
  MessageOutlined
} from '@ant-design/icons'
import { Dashboard, ErrorBoundary } from './components'
import './App.css'

const { Header, Content } = Layout
const { Title } = Typography

function App() {
  return (
    <ErrorBoundary>
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
          <Router>
            <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
              <Header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                height: '56px',
                background: 'var(--bg-header)',
                borderBottom: '1px solid var(--border-secondary)',
                position: 'sticky',
                top: 0,
                zIndex: 100
              }}>
                {/* Company Name */}
                <a
                  href="https://wareongo.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}
                >
                  <Title level={5} style={{
                    color: 'var(--text-primary)',
                    margin: 0,
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}>
                    WareOnGo
                  </Title>
                </a>

                {/* Right Side Tools */}
                <Space size="medium">
                  <Button
                    type="text"
                    icon={<FileTextOutlined />}
                    className="navbar-btn"
                    size="small"
                  >
                    PPT Generator
                  </Button>

                  <Button
                    type="text"
                    icon={<MessageOutlined />}
                    className="navbar-btn"
                    size="small"
                  >
                    Chat Agent
                  </Button>

                  <div className="user-profile" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    cursor: 'pointer'
                  }}>
                    <UserOutlined style={{ color: 'var(--text-muted)', fontSize: '14px' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      Admin User
                    </span>
                  </div>
                </Space>
              </Header>
              <Content style={{
                background: 'var(--bg-primary)',
                minHeight: 'calc(100vh - 56px)',
                padding: '20px'
              }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  {/* Future routes can be added here */}
                </Routes>
              </Content>
            </Layout>
          </Router>
        </AntApp>
      </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App
