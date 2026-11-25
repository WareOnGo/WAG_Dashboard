import { apiClient } from '../apiClient';
import { getStoredToken } from '../../utils/tokenStorage';
vi.mock('../apiClient', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock('../../utils/tokenStorage', () => ({ getStoredToken: vi.fn() }));
let service;
beforeEach(async () => {
  vi.resetAllMocks();
  vi.resetModules();
  getStoredToken.mockReturnValue('admin-fixture');
  service = (await import('../aiQaService')).aiQaService;
});

it('manual processing uses the admin client with a timeout that accommodates bounded inference', async () => {
  const signal = new AbortController().signal;
  apiClient.post.mockResolvedValue({ data: { status: 'COMPLETED' } });
  expect(await service.processRun('saved/run', signal)).toEqual({ status: 'COMPLETED' });
  expect(apiClient.post).toHaveBeenCalledWith(
    '/ai-qa/runs/saved%2Frun/process',
    {},
    { signal, timeout: 105000 }
  );
});

it('a lost batch response reuses its operation ID and a changed admin receives a separate ID', async () => {
  apiClient.post
    .mockRejectedValueOnce(new Error('Transport interrupted'))
    .mockResolvedValue({ data: { id: 'saved-run' } });
  await expect(service.createRun([603])).rejects.toThrow();
  const firstId = apiClient.post.mock.calls[0][1].request_id;
  await service.createRun([603]);
  expect(apiClient.post.mock.calls[1][1].request_id).toBe(firstId);
  getStoredToken.mockReturnValue('another-admin-fixture');
  await service.createRun([603]);
  expect(apiClient.post.mock.calls[2][1].request_id).not.toBe(firstId);
});
