import { describe, expect, it, vi } from 'vitest';
import { createWarehouseViewportLoader, warehouseRequestBbox, EMPTY_WAREHOUSE_POINTS } from '../warehouseViewport';

const VIEW = '77,12,78,13';
const NUDGE = '77.1,12.1,78.1,13.1';
const FAR = '80,15,81,16';
const fc = (id, truncated = false) => ({ type: 'FeatureCollection', features: [{ properties: { id } }], truncated });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const setup = () => {
  const fetchPoints = vi.fn().mockResolvedValue(fc(1));
  const onData = vi.fn(), onStatus = vi.fn();
  return { fetchPoints, onData, onStatus, loader: createWarehouseViewportLoader({ fetchPoints, onData, onStatus }) };
};

describe('warehouse viewport bounds', () => {
  it('pads a local viewport and caps padding at the API span limit', () => {
    expect(warehouseRequestBbox(VIEW)).toBe('76.600000,11.600000,78.400000,13.400000');
    const [w, s, e, n] = warehouseRequestBbox('60,0,88,20').split(',').map(Number);
    expect(e - w).toBeLessThanOrEqual(30);
    expect(n - s).toBeLessThanOrEqual(30);
    expect(w).toBeLessThanOrEqual(60);
    expect(e).toBeGreaterThanOrEqual(88);
  });
  it.each(['0,0,100,80', '1,2,1,3', 'x,2,3,4', '1,2,3', '-181,0,-175,4'])('does not send invalid or oversized bounds: %s', bounds => {
    expect(warehouseRequestBbox(bounds)).toBeNull();
  });
});

describe('warehouse viewport requests', () => {
  it('reuses a complete padded viewport for small pans and refetches outside it', async () => {
    const { loader, fetchPoints } = setup();
    await loader.load(VIEW);
    await loader.load(NUDGE);
    expect(fetchPoints).toHaveBeenCalledTimes(1);
    await loader.load(FAR);
    expect(fetchPoints).toHaveBeenCalledTimes(2);
    expect(fetchPoints).toHaveBeenLastCalledWith(expect.objectContaining({ bbox: warehouseRequestBbox(FAR), limit: 2000 }));
  });
  it('collapses repeated moves inside an in-flight request', async () => {
    const { loader, fetchPoints } = setup();
    const request = deferred();
    fetchPoints.mockReturnValueOnce(request.promise);
    const loading = loader.load(VIEW);
    await loader.load(NUDGE);
    expect(fetchPoints).toHaveBeenCalledTimes(1);
    request.resolve(fc(1));
    await loading;
  });
  it('cancels superseded requests and ignores their late responses', async () => {
    const { loader, fetchPoints, onData } = setup();
    const old = deferred();
    fetchPoints.mockReturnValueOnce(old.promise).mockResolvedValueOnce(fc(2));
    const loading = loader.load(VIEW);
    const signal = fetchPoints.mock.calls[0][0].signal;
    await loader.load(FAR);
    expect(signal.aborted).toBe(true);
    old.resolve(fc(1));
    await loading;
    expect(onData).toHaveBeenLastCalledWith(fc(2));
  });
  it('cancels a pending distant request when returning to cached bounds', async () => {
    const { loader, fetchPoints, onData } = setup();
    await loader.load(VIEW);
    const pending = deferred();
    fetchPoints.mockReturnValueOnce(pending.promise);
    const loading = loader.load(FAR);
    await loader.load(VIEW);
    expect(fetchPoints.mock.calls[1][0].signal.aborted).toBe(true);
    pending.resolve(fc(2));
    await loading;
    expect(onData).toHaveBeenLastCalledWith(fc(1));
  });
  it('clears mismatched pins and forwards all current filters before fetching', async () => {
    const { loader, fetchPoints, onData } = setup();
    await loader.load(VIEW);
    const request = deferred();
    fetchPoints.mockReturnValueOnce(request.promise);
    const filters = { city: 'Bengaluru', fireNoc: 'available', minArea: '5000', contactPerson: 'Sharma' };
    const loading = loader.load(VIEW, filters);
    expect(onData).toHaveBeenLastCalledWith(EMPTY_WAREHOUSE_POINTS);
    expect(fetchPoints).toHaveBeenLastCalledWith(expect.objectContaining({ filters }));
    request.resolve(fc(2));
    await loading;
  });
  it('refetches a truncated viewport after zooming even inside the padded area', async () => {
    const { loader, fetchPoints } = setup();
    fetchPoints.mockResolvedValueOnce(fc(1, true));
    await loader.load(VIEW);
    await loader.load(VIEW);
    expect(fetchPoints).toHaveBeenCalledTimes(1);
    await loader.load('77.2,12.2,77.8,12.8');
    expect(fetchPoints).toHaveBeenCalledTimes(2);
  });
  it('finishes a zoom made during a truncated request with a closer query', async () => {
    const { loader, fetchPoints, onData } = setup();
    const request = deferred();
    fetchPoints.mockReturnValueOnce(request.promise).mockResolvedValueOnce(fc(2));
    const loading = loader.load(VIEW);
    await loader.load('77.2,12.2,77.8,12.8');
    request.resolve(fc(1, true));
    await loading;
    await Promise.resolve();
    expect(fetchPoints).toHaveBeenCalledTimes(2);
    expect(onData).toHaveBeenLastCalledWith(fc(2));
  });
  it('keeps loaded pins on a fetch failure and allows an explicit retry', async () => {
    const { loader, fetchPoints, onData, onStatus } = setup();
    await loader.load(VIEW);
    fetchPoints.mockRejectedValueOnce(new Error('offline'));
    await loader.load(FAR);
    expect(onData).toHaveBeenLastCalledWith(fc(1));
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ loading: false, error: expect.any(String) }));
    await loader.load(FAR, {}, true);
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ error: null }));
  });
  it('clears pins and asks for zoom without querying an oversized viewport', async () => {
    const { loader, fetchPoints, onData, onStatus } = setup();
    await loader.load('0,0,100,80');
    expect(fetchPoints).not.toHaveBeenCalled();
    expect(onData).toHaveBeenLastCalledWith(EMPTY_WAREHOUSE_POINTS);
    expect(onStatus).toHaveBeenLastCalledWith({ zoomRequired: true });
  });
  it('invalidates cached data on reset and stops writes after disposal', async () => {
    const { loader, fetchPoints, onData } = setup();
    await loader.load(VIEW);
    loader.reset();
    const request = deferred();
    fetchPoints.mockReturnValueOnce(request.promise);
    const loading = loader.load(VIEW);
    loader.dispose();
    expect(fetchPoints.mock.calls[1][0].signal.aborted).toBe(true);
    request.resolve(fc(2));
    await loading;
    expect(onData).toHaveBeenLastCalledWith(EMPTY_WAREHOUSE_POINTS);
  });
});
