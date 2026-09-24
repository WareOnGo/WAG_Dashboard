import { apiClient } from './apiClient.js';

/**
 * In-memory label cache, keyed by warehouseId.
 *
 * NOT browser cache — these are authenticated GETs the app issues itself, so
 * nothing is stored by the browser. This Map lives in module scope: it survives
 * modal opens and route changes within a tab, and is discarded on refresh.
 *
 * Secondary path only. The dashboard list requests `includeImageLabels=true`
 * and gets labels attached to each row, so the common case needs neither this
 * cache nor a request. This covers callers that do not (the review queue), and
 * keeps repeat opens instant. Bounded in practice by "warehouses actually
 * opened", not by pages browsed.
 *
 * A value of `{}` is a real answer ("this warehouse has no labels"), distinct
 * from `undefined` ("not looked up yet"), so a warehouse with nothing to show
 * is not re-requested on every open.
 */
const cache = new Map();
const images = new Map();
const expires = new Map();
const fresh = id => (expires.get(Number(id)) ?? 0) > Date.now();

export const imageLabelService = {
  /**
   * Synchronous cache read. Returns undefined on a miss.
   * @param {number|string} warehouseId
   * @returns {Record<string, { classification: string, description: string|null, confidence: number|null }>|undefined}
   */
  getCached: (warehouseId) => fresh(warehouseId) ? cache.get(Number(warehouseId)) : undefined,
  getCachedImages: warehouseId => fresh(warehouseId) ? images.get(Number(warehouseId)) : undefined,

  /**
   * Fetch labels for one warehouse, populating the cache.
   * @param {number|string} warehouseId
   * @returns {Promise<Record<string, Object>>} labels keyed by image URL
   */
  getForWarehouse: async (warehouseId) => {
    const res = await apiClient.get(`/image-labels/warehouse/${warehouseId}`);
    const labels = (res?.data ?? res)?.labels ?? {};
    cache.set(Number(warehouseId), labels);
    images.set(Number(warehouseId), (res?.data ?? res)?.images);
    expires.set(Number(warehouseId), Date.now() + 300_000);
    return labels;
  },

  /** Drop cached labels. Call after anything that changes a warehouse's media. */
  invalidate: (warehouseId) => {
    if (warehouseId === undefined) { cache.clear(); images.clear(); expires.clear(); }
    else { cache.delete(Number(warehouseId)); images.delete(Number(warehouseId)); expires.delete(Number(warehouseId)); }
  },
};
