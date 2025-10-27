import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// Configure axios instance for warehouse API
const warehouseAPI = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for consistent error handling
warehouseAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error handling for different status codes
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          // Validation errors with issues array
          error.message = data.error || 'Validation failed';
          error.issues = data.issues || [];
          break;
        case 404:
          error.message = 'Warehouse not found';
          break;
        case 500:
          error.message = 'Internal server error. Please try again later.';
          break;
        default:
          error.message = data.error || `Server error (${status})`;
      }
    } else if (error.request) {
      // Network error
      error.message = 'Network error - please check your connection and try again';
    } else {
      error.message = error.message || 'Request configuration error';
    }
    
    return Promise.reject(error);
  }
);

export const warehouseService = {
  /**
   * Get all warehouses
   * @returns {Promise} Array of warehouse objects with nested WarehouseData
   */
  getAll: async () => {
    try {
      const response = await warehouseAPI.get('/warehouses');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Create a new warehouse
   * @param {Object} warehouseData - Warehouse data with nested warehouseData
   * @returns {Promise} Created warehouse object
   */
  create: async (warehouseData) => {
    try {
      const response = await warehouseAPI.post('/warehouses', warehouseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Update an existing warehouse
   * @param {number} id - Warehouse ID
   * @param {Object} warehouseData - Updated warehouse data with nested warehouseData
   * @returns {Promise} Updated warehouse object
   */
  update: async (id, warehouseData) => {
    try {
      const response = await warehouseAPI.put(`/warehouses/${id}`, warehouseData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Delete a warehouse
   * @param {number} id - Warehouse ID
   * @returns {Promise} No content (204 status)
   */
  delete: async (id) => {
    try {
      const response = await warehouseAPI.delete(`/warehouses/${id}`);
      // Handle 204 No Content response
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Get presigned URL for file upload
   * @param {string} contentType - MIME type of the file to upload
   * @returns {Promise} Object containing uploadUrl and imageUrl
   */
  getPresignedUrl: async (contentType) => {
    try {
      const response = await warehouseAPI.post('/warehouses/presigned-url', {
        contentType
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Upload file directly to R2 storage using presigned URL
   * @param {string} uploadUrl - Presigned URL for upload
   * @param {File} file - File object to upload
   * @returns {Promise} Upload response
   */
  uploadFileToR2: async (uploadUrl, file) => {
    try {
      // Create a separate axios instance for R2 upload to avoid interceptors
      const response = await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
        // Don't include default headers that might interfere with R2
        transformRequest: [(data) => data],
      });
      return response;
    } catch (error) {
      // Handle R2-specific upload errors
      if (error.response) {
        const { status } = error.response;
        switch (status) {
          case 403:
            error.message = 'Upload forbidden - invalid or expired presigned URL';
            break;
          case 413:
            error.message = 'File too large for upload';
            break;
          default:
            error.message = 'File upload failed';
        }
      } else if (error.request) {
        error.message = 'Network error during file upload';
      } else {
        error.message = 'File upload configuration error';
      }
      throw error;
    }
  },
};