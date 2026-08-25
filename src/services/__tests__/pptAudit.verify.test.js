import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The PPT engine and the dashboard backend are different origins in production;
// stub them apart so the test can prove the audit report goes to the backend.
vi.stubEnv('VITE_PPT_API_BASE_URL', 'http://engine.test/api');
vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test/api');

const getStoredToken = vi.fn();
const isValidToken = vi.fn();
vi.mock('../../utils/tokenStorage.js', () => ({ getStoredToken: () => getStoredToken() }));
vi.mock('../../utils/jwtUtils.js', () => ({ isValidToken: (t) => isValidToken(t) }));

const PPT_ARGS = {
  ids: '101, 102,103',
  selectedImages: { 101: ['a.jpg', 'b.jpg'], 102: ['c.jpg'] },
  customDetails: { clientName: 'Acme Logistics', clientRequirement: '50k sqft Bhiwandi' },
};

/** Split captured fetch calls into the engine request and the audit report. */
function calls() {
  const all = global.fetch.mock.calls;
  return {
    engine: all.find(([url]) => String(url).includes('generate')),
    audit: all.find(([url]) => String(url).includes('/audit/ppt-export')),
  };
}
const auditBody = () => JSON.parse(calls().audit[1].body);

let service;

beforeEach(async () => {
  vi.resetModules();
  getStoredToken.mockReturnValue('a.valid.token');
  isValidToken.mockReturnValue(true);
  global.fetch = vi.fn();
  global.URL.createObjectURL = vi.fn(() => 'blob:x');
  global.URL.revokeObjectURL = vi.fn();
  service = await import('../pptService.js');
});

afterEach(() => { vi.clearAllMocks(); });

/** A successful engine response returning a .pptx blob. */
const engineOk = (size = 2048) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  blob: async () => ({ size }),
});

describe('PPT export audit reporting', () => {
  it('reports a successful export to the backend, not the engine', async () => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: true, status: 204 }));

    await service.generateDetailedPpt(PPT_ARGS);

    const { engine, audit } = calls();
    expect(engine[0]).toBe('http://engine.test/api/generate-detailed-ppt');
    expect(audit[0]).toBe('http://backend.test/api/audit/ppt-export');
    expect(audit[1].method).toBe('POST');
    expect(audit[1].keepalive).toBe(true);
    expect(audit[1].headers.Authorization).toBe('Bearer a.valid.token');

    expect(auditBody()).toMatchObject({
      variant: 'detailed',
      warehouseIds: [101, 102, 103],
      outcome: 'success',
      httpStatus: 200,
      bytes: 2048,
      clientName: 'Acme Logistics',
      clientRequirement: '50k sqft Bhiwandi',
      selectedImageCount: 3,
    });
    expect(typeof auditBody().durationMs).toBe('number');
  });

  it.each([
    ['generateDetailedPpt', 'detailed'],
    ['generatePptV2', 'v2'],
    ['generateGodamwalePpt', 'godamwale'],
    ['generateTciPpt', 'tci'],
  ])('labels %s as the %s variant', async (fn, variant) => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: true, status: 204 }));

    await service[fn](PPT_ARGS);

    expect(auditBody().variant).toBe(variant);
  });

  it('never sends warehouse data or the selected image URLs — counts only', async () => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: true, status: 204 }));

    await service.generatePptV2(PPT_ARGS);

    const body = auditBody();
    expect(body.selectedImages).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('a.jpg');
    expect(body.selectedImageCount).toBe(3);
  });

  it('still reports when the engine fails, and rethrows to the caller', async () => {
    global.fetch.mockImplementation(async (url) => (String(url).includes('generate')
      ? { ok: false, status: 500, json: async () => ({ error: 'Engine exploded' }) }
      : { ok: true, status: 204 }));

    await expect(service.generateTciPpt(PPT_ARGS)).rejects.toThrow('Engine exploded');

    expect(auditBody()).toMatchObject({
      variant: 'tci', outcome: 'failed', httpStatus: 500, errorMessage: 'Engine exploded',
    });
  });

  it('does not break the download when the audit endpoint fails (criterion 4)', async () => {
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('generate')) return engineOk();
      throw new Error('audit endpoint down');
    });

    // Resolves normally: the download happened and the failed report is invisible.
    await expect(service.generateDetailedPpt(PPT_ARGS)).resolves.toBeUndefined();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(calls().audit).toBeDefined();
  });

  it('does not break the download when the audit endpoint 500s', async () => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: false, status: 500 }));

    await expect(service.generateDetailedPpt(PPT_ARGS)).resolves.toBeUndefined();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });

  it('skips the report entirely when there is no valid token', async () => {
    isValidToken.mockReturnValue(false);
    global.fetch.mockImplementation(async () => engineOk());

    await service.generateDetailedPpt(PPT_ARGS);

    expect(calls().engine).toBeDefined();
    expect(calls().audit).toBeUndefined();
  });

  it('reports an empty id list rather than skipping (TCI allows no ids)', async () => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: true, status: 204 }));

    await service.generateTciPpt({ ...PPT_ARGS, ids: '' });

    expect(auditBody()).toMatchObject({ variant: 'tci', warehouseIds: [], outcome: 'success' });
  });

  it('drops junk from the id CSV instead of sending values the backend rejects', async () => {
    global.fetch.mockImplementation(async (url) =>
      (String(url).includes('generate') ? engineOk() : { ok: true, status: 204 }));

    await service.generatePptV2({ ...PPT_ARGS, ids: '5, ,abc, 7 ,-3,' });

    expect(auditBody().warehouseIds).toEqual([5, 7]);
  });

  it('reports after the outcome is known, so a row is never just an intent', async () => {
    const order = [];
    global.fetch.mockImplementation(async (url) => {
      if (String(url).includes('generate')) { order.push('engine'); return engineOk(); }
      order.push('audit');
      return { ok: true, status: 204 };
    });

    await service.generateDetailedPpt(PPT_ARGS);

    expect(order).toEqual(['engine', 'audit']);
  });
});
