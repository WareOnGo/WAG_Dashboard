import { message, notification } from 'antd';

/**
 * Centralized error handling utility for the warehouse dashboard
 * Provides consistent error display and messaging across the application
 * 
 * Note: For components, prefer using the useErrorHandler hook for better context support
 */

/**
 * Error types for categorization
 */
export const ERROR_TYPES = {
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  NETWORK: 'network',
  SERVER: 'server',
  UPLOAD: 'upload',
  GENERIC: 'generic'
};

/**
 * Parse API error response and extract relevant information
 * @param {Error} error - The error object from axios or other sources
 * @returns {Object} Parsed error information
 */
export const parseError = (error) => {
  const errorInfo = {
    type: ERROR_TYPES.GENERIC,
    message: 'An unexpected error occurred',
    details: null,
    issues: [],
    statusCode: null
  };

  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    errorInfo.statusCode = status;

    switch (status) {
      case 400:
        errorInfo.type = ERROR_TYPES.VALIDATION;
        errorInfo.message = data.error || 'Validation failed';
        errorInfo.issues = data.issues || [];
        break;
      
      case 404:
        errorInfo.type = ERROR_TYPES.NOT_FOUND;
        errorInfo.message = 'Warehouse not found';
        break;
      
      case 500:
        errorInfo.type = ERROR_TYPES.SERVER;
        errorInfo.message = 'Internal server error. Please try again later.';
        break;
      
      default:
        errorInfo.message = data.error || `Server error (${status})`;
    }
  } else if (error.request) {
    // Network error - no response received
    errorInfo.type = ERROR_TYPES.NETWORK;
    errorInfo.message = 'Network error - please check your connection and try again';
  } else {
    // Request configuration error
    errorInfo.message = error.message || 'Request configuration error';
  }

  return errorInfo;
};

/**
 * Display error using Ant Design message component
 * @param {Error|Object} error - Error object or parsed error info
 * @param {Object} options - Display options
 */
export const showErrorMessage = (error, options = {}) => {
  const {
    duration = 6,
    showDetails = false,
    prefix = ''
  } = options;

  const errorInfo = error.type ? error : parseError(error);
  const displayMessage = prefix ? `${prefix}: ${errorInfo.message}` : errorInfo.message;

  if (errorInfo.type === ERROR_TYPES.VALIDATION && errorInfo.issues.length > 0) {
    // Show validation errors with details
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
 * Display error using Ant Design notification component (for more detailed errors)
 * @param {Error|Object} error - Error object or parsed error info
 * @param {Object} options - Display options
 */
export const showErrorNotification = (error, options = {}) => {
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
export const handleOperationError = (error, operation, options = {}) => {
  const errorInfo = parseError(error);
  
  const operationMessages = {
    fetch: 'Failed to load warehouses',
    create: 'Failed to create warehouse',
    update: 'Failed to update warehouse',
    delete: 'Failed to delete warehouse',
    upload: 'Failed to upload file'
  };

  const baseMessage = operationMessages[operation] || `Failed to ${operation}`;
  
  // Use notification for validation errors to show more details
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
 * @param {Error} error - Upload error
 * @param {string} fileName - Name of the file being uploaded
 */
export const handleUploadError = (error, fileName = 'file') => {
  const errorInfo = parseError(error);
  
  // Customize upload error messages
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
 * @param {string} operation - The operation that succeeded
 * @param {Object} options - Display options
 */
export const showSuccessMessage = (operation, options = {}) => {
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
export const clearErrors = () => {
  message.destroy();
  notification.destroy();
};

/**
 * Retry wrapper that handles errors consistently
 * @param {Function} operation - The async operation to retry
 * @param {Object} options - Retry options
 */
export const withRetry = async (operation, options = {}) => {
  const { 
    maxRetries = 2, 
    delay = 1000, 
    onError = null,
    operationType = 'operation'
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        // Final attempt failed
        const errorInfo = handleOperationError(error, operationType);
        if (onError) onError(errorInfo);
        throw error;
      }
      
      // Wait before retry (except for validation errors which shouldn't be retried)
      const errorInfo = parseError(error);
      if (errorInfo.type === ERROR_TYPES.VALIDATION) {
        handleOperationError(error, operationType);
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  
  throw lastError;
};

export default {
  parseError,
  showErrorMessage,
  showErrorNotification,
  handleOperationError,
  handleUploadError,
  showSuccessMessage,
  clearErrors,
  withRetry,
  ERROR_TYPES
};