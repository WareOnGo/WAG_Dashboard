import { apiClient } from './apiClient.js';

// Session cache. The POC list is effectively static during a session, so we
// memoise the in-flight/resolved promise to dedupe concurrent callers and avoid
// refetching every time the PPT modal reopens. Cleared on error so a later call
// retries, and exposed via clearCache() for an explicit refresh (e.g. logout).
let listPromise = null;

export const verifiedNumberService = {
  /**
   * List active verified numbers (WareOnGo POCs) as { id, name, phone_number, email }.
   * Used to populate POC pickers (e.g. the PPT generator). Unwraps the { data }
   * envelope; tolerates a bare array response too. Cached for the session.
   * @param {{ force?: boolean }} [opts] - force: bypass the cache and refetch
   * @returns {Promise<Array<{ id: number, name: string, phone_number: string, email: string|null }>>}
   */
  list: ({ force = false } = {}) => {
    if (!listPromise || force) {
      listPromise = apiClient
        .get('/verified-numbers')
        .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
        .catch((err) => {
          listPromise = null; // allow a retry on the next call
          throw err;
        });
    }
    return listPromise;
  },

  /** Drop the cached list (e.g. on logout or after a known mutation). */
  clearCache: () => { listPromise = null; },
};

export default verifiedNumberService;
