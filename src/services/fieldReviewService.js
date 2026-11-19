import { apiClient } from './apiClient';

// A retry after a network/5xx failure reuses the same operation key. Successful
// actions and definite client errors release it so a later intentional action
// can never accidentally replay an earlier one.
const retries = new Map();
const unwrap = async promise => {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.error;
    error.message = typeof detail === 'string' ? detail : detail?.message || error.message || 'Could not load field reviews.';
    error.code = detail?.code;
    throw error;
  }
};
async function write(method, path, body) {
  const key = JSON.stringify([method, path, body]);
  const cached = retries.get(key);
  const requestId = cached && Date.now() - cached.at < 300000 ? cached.id : crypto.randomUUID();
  retries.set(key, {
    id: requestId,
    at: Date.now()
  });
  try {
    const result = await unwrap(apiClient[method](path, {
      ...body,
      requestId
    }));
    retries.delete(key);
    window.dispatchEvent(new Event('warehouse-field-review-updated'));
    return result;
  } catch (e) {
    if (e.response?.status >= 400 && e.response?.status < 500) retries.delete(key);
    throw e;
  }
}
const root = '/field-reviews';
const flagPath = (id, flag) => root + '/' + id + '/flags/' + flag;
export const fieldReviewService = {
  setup: id => unwrap(apiClient.get(root + '/setup/' + id)),
  list: (params, signal) => unwrap(apiClient.get(root, {
    params,
    signal
  })),
  detail: (id, signal) => unwrap(apiClient.get(root + '/' + id, {
    signal
  })),
  summaries: (ids, signal) => ids.length ? unwrap(apiClient.get(root + '/summaries', {
    params: {
      ids: ids.join(',')
    },
    signal
  })) : Promise.resolve([]),
  events: (id, cursor) => unwrap(apiClient.get(root + '/' + id + '/events', {
    params: {
      cursor
    }
  })),
  history: (id, flag) => unwrap(apiClient.get(flagPath(id, flag) + '/history')),
  reveal: (id, flag, reason) => unwrap(apiClient.post(flagPath(id, flag) + '/reveal', {
    reason
  })),
  upload: (id, flag, contentType) => unwrap(apiClient.post(flagPath(id, flag) + '/upload', { contentType })),
  create: body => write('post', root, body),
  respond: (id, flag, body) => write('post', flagPath(id, flag) + '/response', body),
  decide: (id, flag, body) => write('post', flagPath(id, flag) + '/decision', body),
  returnForChanges: (id, flag, body) => write('post', flagPath(id, flag) + '/return', body),
  reopen: (id, flag, body) => write('post', flagPath(id, flag) + '/reopen', body),
  cancel: (id, flag, body) => write('post', flagPath(id, flag) + '/cancel', body),
  reassign: (id, body) => write('patch', root + '/' + id + '/assignee', body)
};
