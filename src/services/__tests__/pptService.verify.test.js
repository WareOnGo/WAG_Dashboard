import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Generation moved from the standalone proposal engine into the dashboard
// backend. Leaving VITE_PPT_API_BASE_URL unset here is the point: it proves the
// default path now targets the API base, which is what production will do once
// the env var is dropped.
vi.stubEnv('VITE_PPT_API_BASE_URL', '');
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

const ok = (size = 2048) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  blob: async () => ({ size }),
});

describe('PPT generation requests', () => {
  it.each([
    ['generateDetailedPpt', '/generate-detailed-ppt'],
    ['generatePptV2', '/generate-ppt-v2'],
    ['generateGodamwalePpt', '/generate-ppt-godamwale'],
    ['generateTciPpt', '/generate-ppt-tci'],
  ])('%s posts to the backend at %s', async (fn, endpoint) => {
    global.fetch.mockResolvedValue(ok());

    await service[fn](PPT_ARGS);

    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe(`http://backend.test/api${endpoint}`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer a.valid.token');
  });

  // The backend audits these itself now. If the client also reported, every
  // export would land in audit_logs twice — once observed, once asserted.
  it('does not report the export to the audit endpoint', async () => {
    global.fetch.mockResolvedValue(ok());

    await service.generatePptV2(PPT_ARGS);

    const audited = global.fetch.mock.calls
      .some(([url]) => String(url).includes('/audit/ppt-export'));
    expect(audited).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a server error message to the caller', async () => {
    global.fetch.mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ error: 'Engine exploded' }),
      headers: { get: () => null },
    });

    await expect(service.generateTciPpt(PPT_ARGS)).rejects.toThrow('Engine exploded');
  });
});
