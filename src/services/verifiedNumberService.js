import { apiClient } from './apiClient.js';

// Session cache. The POC list is effectively static during a session, so we
// memoise the in-flight/resolved promise to dedupe concurrent callers and avoid
// refetching every time the PPT modal reopens. Cleared on error so a later call
// retries, and exposed via clearCache() for an explicit refresh (e.g. logout).
let listPromise = null;

const clearCache = () => { listPromise = null; };

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
  clearCache,

  // --- Admin roster management (requires the ADMIN capability) ---------------
  //
  // These write to the same rows `list` reads, so every mutation clears the POC
  // cache — otherwise the PPT picker would keep serving names and numbers that
  // have since been renamed or deactivated.

  /**
   * Full roster for the admin panel.
   * @param {{ search?: string, includeInactive?: boolean }} [params]
   * @returns {Promise<Array<Object>>}
   */
  adminList: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.includeInactive) query.set('includeInactive', 'true');
    const qs = query.toString();
    return apiClient
      .get(`/verified-numbers/admin${qs ? `?${qs}` : ''}`)
      .then((res) => (Array.isArray(res) ? res : (res?.data ?? [])));
  },

  /** Add an employee. empID is assigned by the server. */
  adminCreate: (data) =>
    apiClient.post('/verified-numbers/admin', data).then((row) => {
      clearCache();
      return row;
    }),

  /**
   * Edit an employee's details or capabilities.
   * Editing phone_number/empID needs `confirmIdentityChange: true` — the server
   * replies 409 with { details: { requiresConfirmation, fields, dependents } } first.
   */
  adminUpdate: (id, data) =>
    apiClient.patch(`/verified-numbers/admin/${id}`, data).then((row) => {
      clearCache();
      return row;
    }),
};

export default verifiedNumberService;
