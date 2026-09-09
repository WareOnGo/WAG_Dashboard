import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mswServer';
import { warehouseService } from '../warehouseService';
import { mockWarehouseFormData } from '../../test/mockData';

const url = 'http://localhost:3001/api/warehouses';

describe('warehouseService API contracts', () => {
  it('keeps pagination metadata when fetching a filtered page', async () => {
    const result = await warehouseService.list({ page: 1, limit: 1, search: 'Industrial', includeImageLabels: 'true' });
    expect(result.data.map(row => row.id)).toEqual([1]);
    expect(result.pagination).toEqual({ page: 1, limit: 1, total: 1, totalPages: 1 });
  });

  it('requests all warehouses and unwraps the response envelope', async () => {
    let params;
    server.use(http.get(url, ({ request }) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json({ data: [{ id: 1 }, { id: 2 }], pagination: { total: 2 } });
    }));
    expect(await warehouseService.getAll()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(params.get('all')).toBe('true');
  });

  it('still accepts a legacy flat-array response', async () => {
    server.use(http.get(url, () => HttpResponse.json([{ id: 12 }])));
    expect(await warehouseService.getAll()).toEqual([{ id: 12 }]);
  });

  it('resolves only the requested IDs and asks for image labels', async () => {
    let params;
    server.use(http.get(url, ({ request }) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json({ data: [{ id: 2 }], pagination: { total: 1 } });
    }));
    expect(await warehouseService.getByIds([2, 999])).toEqual([{ id: 2 }]);
    expect(Object.fromEntries(params)).toEqual({ ids: '2,999', all: 'true', includeImageLabels: 'true' });
  });

  it('returns the promoted submission receipt instead of treating it as a full row', async () => {
    const result = await warehouseService.create(mockWarehouseFormData);
    expect(result).toEqual(expect.objectContaining({
      submissionId: expect.any(String), warehouseId: expect.any(Number), autoApproved: true, reviewStatus: 'APPROVED',
    }));
    expect(result.id).toBe(result.submissionId);
  });

  it('preserves a pending submission receipt with no master warehouse ID', async () => {
    const receipt = { submissionId: 'pending-id', warehouseId: null, reviewStatus: 'PENDING', autoApproved: false };
    server.use(http.post(url, () => HttpResponse.json(receipt, { status: 201 })));
    expect(await warehouseService.create(mockWarehouseFormData)).toEqual(receipt);
  });

  it('rejects a validation error with its message and field issues', async () => {
    await expect(warehouseService.create({})).rejects.toMatchObject({
      message: 'Validation failed', issues: expect.arrayContaining([expect.objectContaining({ path: ['warehouseType'] })]),
    });
  });

  it('updates a warehouse and returns the persisted fields', async () => {
    const result = await warehouseService.update(1, { city: 'Bangalore', visibility: false });
    expect(result).toEqual(expect.objectContaining({ id: 1, city: 'Bangalore', visibility: false }));
  });

  it('does not report success when an update targets a missing warehouse', async () => {
    await expect(warehouseService.update(999, { city: 'Bangalore' })).rejects.toThrow('Warehouse not found');
  });

  it('accepts an empty 204 delete response', async () => {
    expect((await warehouseService.delete(1)).status).toBe(204);
    await expect(warehouseService.delete(999)).rejects.toThrow('Warehouse not found');
  });

  it('surfaces network failure instead of returning an empty successful list', async () => {
    server.use(http.get(url, () => HttpResponse.error()));
    await expect(warehouseService.list()).rejects.toThrow(/Network error/);
  });

  it('surfaces a permission failure', async () => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Forbidden' }, { status: 403 })));
    await expect(warehouseService.list()).rejects.toThrow(/insufficient permissions/);
  });

  it('sends the reveal reason as a query parameter without losing special characters', async () => {
    let reason;
    server.use(http.get(`${url}/1/contact-number`, ({ request }) => {
      reason = new URL(request.url).searchParams.get('reason');
      return HttpResponse.json({ contactNumber: '9876543210' });
    }));
    expect(await warehouseService.getContactNumber(1, 'A&B / site visit')).toEqual({ contactNumber: '9876543210' });
    expect(reason).toBe('A&B / site visit');
  });
});
