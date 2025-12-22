import React from 'react'
import { Result, Button } from 'antd'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Error caught by boundary:', error, errorInfo)
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    })
  }

  handleReload = () => {
    // Reset error state and reload the page
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '50px',
          background: '#141414',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Result
            status="500"
            title="Something went wrong"
            subTitle="An unexpected error occurred in the application. Please try reloading the page."
            extra={
              <Button type="primary" onClick={this.handleReload}>
                Reload Page
              </Button>
            }
            style={{
              color: 'rgba(255, 255, 255, 0.85)'
            }}
          />
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary