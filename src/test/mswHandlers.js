import { http, HttpResponse } from 'msw';
import { mockWarehouses, mockWarehouse, mockApiErrors } from './mockData';

const API_BASE_URL = 'http://localhost:3001/api';

export const handlers = [
  // GET /warehouses - Get all warehouses
  http.get(`${API_BASE_URL}/warehouses`, () => {
    return HttpResponse.json(mockWarehouses);
  }),

  // POST /warehouses - Create new warehouse
  http.post(`${API_BASE_URL}/warehouses`, async ({ request }) => {
    const newWarehouse = await request.json();
    
    // Simulate validation error for testing
    if (!newWarehouse.warehouseType) {
      return HttpResponse.json(mockApiErrors.validation, { status: 400 });
    }
    
    // Return created warehouse with ID
    const createdWarehouse = {
      ...newWarehouse,
      id: Date.now(), // Simple ID generation for testing
    };
    
    return HttpResponse.json(createdWarehouse, { status: 201 });
  }),

  // PUT /warehouses/:id - Update warehouse
  http.put(`${API_BASE_URL}/warehouses/:id`, async ({ params, request }) => {
    const { id } = params;
    const updatedData = await request.json();
    
    // Simulate not found error
    if (id === '999') {
      return HttpResponse.json(mockApiErrors.notFound, { status: 404 });
    }
    
    // Return updated warehouse
    const updatedWarehouse = {
      ...mockWarehouse,
      ...updatedData,
      id: parseInt(id),
    };
    
    return HttpResponse.json(updatedWarehouse);
  }),

  // DELETE /warehouses/:id - Delete warehouse
  http.delete(`${API_BASE_URL}/warehouses/:id`, ({ params }) => {
    const { id } = params;
    
    // Simulate not found error
    if (id === '999') {
      return HttpResponse.json(mockApiErrors.notFound, { status: 404 });
    }
    
    // Return 204 No Content for successful deletion
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /warehouses/presigned-url - Get presigned URL for file upload
  http.post(`${API_BASE_URL}/warehouses/presigned-url`, async ({ request }) => {
    const { contentType: _contentType } = await request.json();
    
    return HttpResponse.json({
      uploadUrl: 'https://mock-r2-bucket.com/upload-url',
      imageUrl: 'https://mock-r2-bucket.com/image-url.jpg',
    });
  }),

  // PUT to mock R2 upload URL - Simulate file upload
  http.put('https://mock-r2-bucket.com/upload-url', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Error simulation handlers
  // GET /warehouses with server error
  http.get(`${API_BASE_URL}/warehouses/error`, () => {
    return HttpResponse.json(mockApiErrors.serverError, { status: 500 });
  }),

  // Network error simulation (will be handled by test setup)
  http.get(`${API_BASE_URL}/warehouses/network-error`, () => {
    return HttpResponse.error();
  }),
];