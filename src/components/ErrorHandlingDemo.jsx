import React from 'react';
import { Button, Space, Card, Typography } from 'antd';
import { 
  showErrorMessage, 
  handleOperationError,
  showSuccessMessage,
  ERROR_TYPES 
} from '../utils/errorHandler';

const { Title, Text } = Typography;

/**
 * Demo component to showcase the error handling system
 * This component demonstrates different types of errors and how they are handled
 */
const ErrorHandlingDemo = () => {
  
  const demoValidationError = () => {
    const mockError = {
      response: {
        status: 400,
        data: {
          error: 'Validation failed',
          issues: [
            { path: ['warehouseType'], message: 'Warehouse type is required' },
            { path: ['address'], message: 'Address must be at least 10 characters' },
            { path: ['contactNumber'], message: 'Invalid phone number format' }
          ]
        }
      }
    };
    
    handleOperationError(mockError, 'create');
  };

  const demoNetworkError = () => {
    const mockError = {
      request: {},
      message: 'Network Error'
    };
    
    handleOperationError(mockError, 'fetch');
  };

  const demoNotFoundError = () => {
    const mockError = {
      response: {
        status: 404,
        data: { error: 'Not found' }
      }
    };
    
    handleOperationError(mockError, 'update');
  };

  const demoServerError = () => {
    const mockError = {
      response: {
        status: 500,
        data: { error: 'Internal server error' }
      }
    };
    
    handleOperationError(mockError, 'delete');
  };

  const demoSuccessMessage = () => {
    showSuccessMessage('create', { details: 'Warehouse "Cold Storage A" created' });
  };

  const demoUploadError = () => {
    const MOCK_ERROR = {
      response: {
        status: 413,
        data: { error: 'File too large' }
      }
    };
    
    showErrorMessage({
      type: ERROR_TYPES.UPLOAD,
      message: 'File too large - please select a smaller file'
    }, {
      prefix: 'Failed to upload warehouse-image.jpg'
    });
  };

  return (
    <Card 
      title="Error Handling System Demo" 
      style={{ 
        margin: '20px',
        background: '#1f1f1f',
        border: '1px solid #303030'
      }}
      headStyle={{ color: '#fff' }}
      bodyStyle={{ background: '#1f1f1f' }}
    >
      <div style={{ marginBottom: '20px' }}>
        <Title level={4} style={{ color: '#fff' }}>
          Error Handling Demonstrations
        </Title>
        <Text style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
          Click the buttons below to see different types of error messages in action.
        </Text>
      </div>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Validation Errors (400)
          </Title>
          <Button 
            type="primary" 
            danger 
            onClick={demoValidationError}
            style={{ marginRight: '8px' }}
          >
            Show Validation Error
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Displays detailed validation issues with field-specific errors
          </Text>
        </div>

        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Network Errors
          </Title>
          <Button 
            type="primary" 
            danger 
            onClick={demoNetworkError}
            style={{ marginRight: '8px' }}
          >
            Show Network Error
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Shows connection-related error messages
          </Text>
        </div>

        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Not Found Errors (404)
          </Title>
          <Button 
            type="primary" 
            danger 
            onClick={demoNotFoundError}
            style={{ marginRight: '8px' }}
          >
            Show Not Found Error
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Displays warehouse not found messages
          </Text>
        </div>

        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Server Errors (500)
          </Title>
          <Button 
            type="primary" 
            danger 
            onClick={demoServerError}
            style={{ marginRight: '8px' }}
          >
            Show Server Error
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Shows internal server error messages
          </Text>
        </div>

        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Upload Errors
          </Title>
          <Button 
            type="primary" 
            danger 
            onClick={demoUploadError}
            style={{ marginRight: '8px' }}
          >
            Show Upload Error
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Displays file upload specific error messages
          </Text>
        </div>

        <div>
          <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
            Success Messages
          </Title>
          <Button 
            type="primary" 
            onClick={demoSuccessMessage}
            style={{ marginRight: '8px' }}
          >
            Show Success Message
          </Button>
          <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
            Shows success confirmation messages
          </Text>
        </div>
      </Space>

      <div style={{ marginTop: '24px', padding: '16px', background: '#262626', borderRadius: '6px' }}>
        <Title level={5} style={{ color: '#fff', marginBottom: '8px' }}>
          Error Handling Features
        </Title>
        <ul style={{ color: 'rgba(255, 255, 255, 0.65)', margin: 0 }}>
          <li>Automatic retry mechanism for network errors</li>
          <li>Detailed validation error display with field-specific messages</li>
          <li>Contextual error messages based on operation type</li>
          <li>Consistent error formatting across all components</li>
          <li>Upload-specific error handling with file information</li>
          <li>Success message confirmation for completed operations</li>
          <li>Error message clearing when operations are retried</li>
        </ul>
      </div>
    </Card>
  );
};

export default ErrorHandlingDemo;