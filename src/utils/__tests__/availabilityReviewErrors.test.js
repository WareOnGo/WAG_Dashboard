import { expect, it, vi } from 'vitest';
import { parseError, withRetry } from '../errorHandler';
import { message } from 'antd';

vi.mock('antd', () => ({ message: { error: vi.fn() }, notification: { error: vi.fn() } }));

it('does not retry a stale review and keeps the server recovery message', async () => {
  const error = { response: { status: 409, data: { error: 'Refresh the list and reopen the record.' } } };
  const save = vi.fn().mockRejectedValue(error);
  await expect(withRetry(save, { delay: 0 })).rejects.toBe(error);
  expect(save).toHaveBeenCalledTimes(1);
  expect(parseError(error).message).toBe(error.response.data.error);
});

it('reads field errors from the API validation response', () => {
  const issues = [{ path: ['availabilityLastReviewedOn'], message: 'Review date cannot be in the future' }];
  expect(parseError({ response: { status: 400, data: { error: 'Validation failed', details: { issues } } } }).issues)
    .toEqual(issues);
});

it.each([400, 409, 503])('uses the supplied notification handler once for a %s save failure', async status => {
  vi.clearAllMocks();
  const error = { response: { status, data: { error: 'Save failed' } } };
  const onError = vi.fn();
  const save = vi.fn().mockRejectedValue(error);
  await expect(withRetry(save, { delay: 0, maxRetries: 1, onError })).rejects.toBe(error);
  expect(save).toHaveBeenCalledTimes(status === 503 ? 2 : 1);
  expect(onError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ statusCode: status }));
  expect(message.error).not.toHaveBeenCalled();
});
