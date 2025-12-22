import { App } from 'antd';
import { parseError, ERROR_TYPES } from '../utils/errorHandler';

/**
 * Custom hook for error handling with Ant Design App context
 * This hook provides access to message and notification APIs with proper context
 */
export const useErrorHandler = () => {
  const { message, notification } = App.useApp();

  /**
   * Display error using Ant Design message component
   */
  const showErrorMessage = (error, options = {}) => {
    const {
      duration = 6,
      showDetails = false,
      prefix = ''
    } = options;

    const errorInfo = error.type ? error : parseError(error);
    const displayMessage = prefix ? `${prefix}: ${errorInfo.message}` : errorInfo.message;

    if (errorInfo.type === ERROR_TYPES.VALIDATION && errorInfo.issues.length > 0) {
      const issueMessages = errorInfo.issues.map(issue => 
        `${issue.path?.join('.')}: ${issue.message}`
      ).join('\n');

      if (showDetails) {
        message.error(`${displayMessage}\n\n${issueMessages}`, duration);
      } else {
        message.error(displayMessage, duration);
      }
    } else {
      message.error(displayMessage, duration);
    }
  };

  /**
   * Display error using Ant Design notification component
   */
  const showErrorNotification = (error, options = {}) => {
    const {
      title = 'Error',
      duration = 8,
      showDetails = true
    } = options;

    const errorInfo = error.type ? error : parseError(error);

    let description = errorInfo.message;
    
    if (errorInfo.type === ERROR_TYPES.VALIDATION && errorInfo.issues.length > 0 && showDetails) {
      const issueList = errorInfo.issues.map((issue, index) => (
        `${index + 1}. ${issue.path?.join('.')}: ${issue.message}`
      )).join('\n');
      
      description = `${errorInfo.message}\n\nValidation Issues:\n${issueList}`;
    }

    notification.error({
      message: title,
      description,
      duration,
      placement: 'topRight',
    });
  };

  /**
   * Handle specific operation errors with contextual messages
   */
  const handleOperationError = (error, operation, options = {}) => {
    const errorInfo = parseError(error);
    
    const operationMessages = {
      fetch: 'Failed to load warehouses',
      create: 'Failed to create warehouse',
      update: 'Failed to update warehouse',
      delete: 'Failed to delete warehouse',
      upload: 'Failed to upload file'
    };

    const baseMessage = operationMessages[operation] || `Failed to ${operation}`;
    
    if (errorInfo.type === ERROR_TYPES.VALIDATION) {
      showErrorNotification(errorInfo, {
        title: baseMessage,
        ...options
      });
    } else {
      showErrorMessage(errorInfo, {
        prefix: baseMessage,
        ...options
      });
    }

    return errorInfo;
  };

  /**
   * Handle file upload specific errors
   */
  const handleUploadError = (error, fileName = 'file') => {
    const errorInfo = parseError(error);
    
    let uploadMessage = errorInfo.message;
    
    if (error.response) {
      const { status } = error.response;
      switch (status) {
        case 403:
          uploadMessage = 'Upload forbidden - please try again';
          break;
        case 413:
          uploadMessage = 'File too large - please select a smaller file';
          break;
        case 415:
          uploadMessage = 'File type not supported - please select an image file';
          break;
      }
    }

    showErrorMessage({
      ...errorInfo,
      message: uploadMessage
    }, {
      prefix: `Failed to upload ${fileName}`,
      duration: 8
    });

    return errorInfo;
  };

  /**
   * Show success message for operations
   */
  const showSuccessMessage = (operation, options = {}) => {
    const { duration = 3, details = '' } = options;
    
    const successMessages = {
      create: 'Warehouse created successfully',
      update: 'Warehouse updated successfully',
      delete: 'Warehouse deleted successfully',
      upload: 'File uploaded successfully'
    };

    const baseMessage = successMessages[operation] || `${operation} completed successfully`;
    const displayMessage = details ? `${baseMessage} - ${details}` : baseMessage;
    
    message.success(displayMessage, duration);
  };

  /**
   * Clear all error messages and notifications
   */
  const clearErrors = () => {
    message.destroy();
    notification.destroy();
  };

  return {
    showErrorMessage,
    showErrorNotification,
    handleOperationError,
    handleUploadError,
    showSuccessMessage,
    clearErrors
  };
};