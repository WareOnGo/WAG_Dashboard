import axios from 'axios';
import { apiClient } from './apiClient.js';

export const warehouseService = {
  /**
   * Get a page of warehouses with server-side filtering/sorting/pagination.
   * @param {Object} params - { page, limit, sortBy, sortOrder, search, city, state,
   *   zone, warehouseType, warehouseOwnerType, availability, isBroker, uploadedBy,
   *   landType, visibility, fireNoc, minArea, maxArea, minRate, maxRate }
   * @returns {Promise<{ data: Array, pagination: { page, limit, total, totalPages } }>}
   */
  list: async (params = {}) => {
    return apiClient.get('/warehouses', { params });
  },

  /**
   * Get coordinates ({ id, lat, lng }) for ALL warehouses matching the given filters
   * (no pagination) — used to keep the map complete while the list view pages.
   * @param {Object} params - Same filter params as `list` (paging/sort ignored server-side)
   * @returns {Promise<Array<{ id: number, lat: number, lng: number }>>}
   */
  getCoordinates: async (params = {}) => {
    return apiClient.get('/warehouses/coordinates', { params });
  },

  /**
   * Get ALL warehouses as a flat array (full objects, no pagination).
   * For full-data consumers (itinerary/PPT builder, micro-market mapping). The
   * Dashboard list uses `list()` instead. Unwraps the paginated envelope.
   * @returns {Promise<Array>} Array of warehouse objects with nested WarehouseData
   */
  getAll: async () => {
    const res = await apiClient.get('/warehouses', { params: { all: 'true' } });
    return Array.isArray(res) ? res : (res?.data ?? []);
  },

  /**
   * Create a new warehouse
   * @param {Object} warehouseData - Warehouse data with nested warehouseData
   * @returns {Promise} Created warehouse object
   */
  create: async (warehouseData) => {
    return apiClient.post('/warehouses', warehouseData);
  },

  /**
   * Update an existing warehouse
   * @param {number} id - Warehouse ID
   * @param {Object} warehouseData - Updated warehouse data with nested warehouseData
   * @returns {Promise} Updated warehouse object
   */
  update: async (id, warehouseData) => {
    return apiClient.put(`/warehouses/${id}`, warehouseData);
  },

  /**
   * Delete a warehouse
   * @param {number} id - Warehouse ID
   * @returns {Promise} No content (204 status)
   */
  delete: async (id) => {
    // Use the underlying axios instance for delete to get full response
    const axiosInstance = apiClient.getAxiosInstance();
    const response = await axiosInstance.delete(`/warehouses/${id}`);
    return response;
  },

  /**
   * Get contact number for a specific warehouse (triggers audit log)
   * @param {number} warehouseId - Warehouse ID
   * @returns {Promise} Object containing contactNumber and contactPerson
   */
  getContactNumber: async (warehouseId) => {
    return apiClient.get(`/warehouses/${warehouseId}/contact-number`);
  },

  // --- Staging / review (admin-only) ---

  /**
   * List staged submissions (review queue).
   * @param {Object} params - { reviewStatus?, page?, limit? }
   * @returns {Promise} Array of staged rows
   */
  listStaged: async (params = {}) => {
    return apiClient.get('/staging', { params });
  },

  /**
   * Get a single staged submission.
   * @param {string} id - Staged row uuid
   * @returns {Promise} Staged row
   */
  getStaged: async (id) => {
    return apiClient.get(`/staging/${id}`);
  },

  /**
   * Apply reviewer edits to a staged submission (the row stays PENDING).
   * @param {string} id - Staged row uuid
   * @param {Object} data - Partial warehouse payload (may include nested warehouseData)
   * @returns {Promise} Updated staged row
   */
  updateStaged: async (id, data) => {
    return apiClient.patch(`/staging/${id}`, data);
  },

  /**
   * Approve a staged submission (promotes it to the master Warehouse table).
   * @param {string} id - Staged row uuid
   * @returns {Promise} The created master warehouse
   */
  approveStaged: async (id) => {
    return apiClient.post(`/staging/${id}/approve`);
  },

  /**
   * Reject a staged submission with a reason.
   * @param {string} id - Staged row uuid
   * @param {string} rejectionReason - Required note explaining the rejection
   * @returns {Promise} Updated staged row
   */
  rejectStaged: async (id, rejectionReason) => {
    return apiClient.post(`/staging/${id}/reject`, { rejectionReason });
  },

  /**
   * Move an approved/rejected submission back to PENDING (revoke / un-reject).
   * Revoking an approved one also removes the warehouse it created from the master list.
   * @param {string} id - Staged row uuid
   * @returns {Promise} Updated staged row (PENDING)
   */
  reopenStaged: async (id) => {
    return apiClient.post(`/staging/${id}/reopen`);
  },

  /**
   * Delete a staged submission (does not remove a promoted master warehouse).
   * @param {string} id - Staged row uuid
   * @returns {Promise} No content
   */
  deleteStaged: async (id) => {
    return apiClient.delete(`/staging/${id}`);
  },

  /**
   * Get the auto-approve ("autopilot") state. Visible to any reviewer.
   * @returns {Promise<{ enabled: boolean }>}
   */
  getAutoApprove: async () => {
    return apiClient.get('/staging/settings/auto-approve');
  },

  /**
   * Toggle auto-approve ("autopilot"). Admin-only on the server.
   * @param {boolean} enabled
   * @returns {Promise<{ enabled: boolean }>}
   */
  setAutoApprove: async (enabled) => {
    return apiClient.patch('/staging/settings/auto-approve', { enabled });
  },

  /**
   * Get presigned URL for file upload
   * @param {string} contentType - MIME type of the file to upload
   * @returns {Promise} Object containing uploadUrl and imageUrl
   */
  getPresignedUrl: async (contentType) => {
    return apiClient.post('/warehouses/presigned-url', {
      contentType
    });
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