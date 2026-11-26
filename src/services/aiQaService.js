import { apiClient } from './apiClient';
import { getStoredToken } from '../utils/tokenStorage';

const root = '/ai-qa';
const retries = new Map();

async function request(path, { body, signal, params, timeout } = {}) {
  try {
    const response = body
      ? await apiClient.post(root + path, body, { signal, ...(timeout ? { timeout } : {}) })
      : await apiClient.get(root + path, { signal, params });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.error;
    error.status = error.response?.status;
    error.code = detail?.code;
    error.message =
      typeof detail === 'string' ? detail : detail?.message || error.message || 'Could not load AI reviews.';
    throw error;
  }
}

async function write(path, body) {
  // Keep the same operation ID after a lost response; scope it to the token so
  // retries cannot cross identities. Never log or persist tokens.
  const key = JSON.stringify([getStoredToken(), path, body]);
  // Bound failed-operation memory for long-lived dashboard tabs.
  for (const [savedKey, entry] of retries) if (Date.now() - entry.at >= 300000) retries.delete(savedKey);
  const prior = retries.get(key);
  const requestId = prior && Date.now() - prior.at < 300000 ? prior.id : crypto.randomUUID();
  if (!prior && retries.size >= 100) retries.delete(retries.keys().next().value);
  retries.set(key, { id: requestId, at: Date.now() });
  try {
    const result = await request(path, { body: { ...body, request_id: requestId } });
    retries.delete(key);
    return result;
  } catch (error) {
    if (error.status >= 400 && error.status < 500) retries.delete(key);
    throw error;
  }
}

const runPath = (id) => '/runs/' + encodeURIComponent(id);
export const aiQaService = {
  summary: (signal, params) => request('/summary', { signal, params }),
  reviewers: (run, signal) => request(runPath(run) + '/reviewers', { signal }),
  config: (signal) => request('/config', { signal }),
  runs: (signal) => request('/runs', { signal }),
  list: (run, signal, params) => request(runPath(run) + '/warehouses', { signal, params }),
  detail: (run, whid, signal) => request(runPath(run) + '/warehouses/' + whid, { signal }),
  mutate: (run, whid, operation, body) => write(runPath(run) + '/warehouses/' + whid + '/' + operation, body),
  createRun: (warehouseIds) => write('/runs', { warehouse_ids: warehouseIds, model: 'gpt-6.2-sol' }),
  // This advances existing durable work; it never enqueues another batch.
  processRun: (run, signal) => request(runPath(run) + '/process', { body: {}, signal, timeout: 105000 }),
  status: (run, signal) => request(runPath(run) + '/status', { signal })
};
