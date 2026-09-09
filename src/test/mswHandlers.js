import { http, HttpResponse } from 'msw';
import { mockWarehouses, mockWarehouse, mockApiErrors } from './mockData';

const API_BASE_URL = 'http://localhost:3001/api';

export const handlers = [
  // Match the list envelope, including full-data consumers that use all=true.
  http.get(`${API_BASE_URL}/warehouses`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    let data = mockWarehouses;
    if (params.has('ids')) {
      const ids = params.get('ids').split(',').map(Number);
      data = data.filter(row => ids.includes(row.id));
    }
    if (params.get('search')) {
      const search = params.get('search').toLowerCase();
      data = data.filter(row => [row.id, row.warehouseType, row.city, row.address]
        .some(value => String(value).toLowerCase().includes(search)));
    }
    const page = Number(params.get('page') || 1);
    const limit = Number(params.get('limit') || 20);
    const total = data.length;
    if (params.get('all') !== 'true') data = data.slice((page - 1) * limit, page * limit);
    return HttpResponse.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }),

  // POST /warehouses - Create new warehouse
  //
  // The real endpoint does NOT return a warehouse. Submissions go through the staging
  // layer, so the 201 body is a submission receipt: `submissionId` (staging uuid, always
  // present) plus `warehouseId` (master Int) which is populated only when autopilot
  // promoted the submission and null when it was left PENDING for review. Callers branch
  // their success copy on that. See Backend_Repository/src/utils/submissionResult.js.
  http.post(`${API_BASE_URL}/warehouses`, async ({ request }) => {
    const newWarehouse = await request.json();

    // Simulate validation error for testing
    if (!newWarehouse.warehouseType) {
      return HttpResponse.json(mockApiErrors.validation, { status: 400 });
    }

    // Mocks the autopilot-on path (the production default).
    const submissionId = '00000000-0000-4000-8000-000000000001';
    return HttpResponse.json({
      submissionId,
      id: submissionId,
      warehouseId: Date.now(),
      reviewStatus: 'APPROVED',
      autoApproved: true,
      warehouseType: newWarehouse.warehouseType ?? null,
      city: newWarehouse.city ?? null,
      state: newWarehouse.state ?? null,
      zone: newWarehouse.zone ?? null,
    }, { status: 201 });
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
