import { describe, expect, it, vi, afterEach } from 'vitest';
import { availabilityPayload, suggestedReviewDate, todayInIndia, formatAvailabilityReview } from '../availabilityReview';

afterEach(() => vi.useRealTimers());
const original = { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10T00:00:00.000Z' };

describe('availability review calendar and payload', () => {
  it('omits untouched fields, including an ISO date loaded from the API', () => {
    expect(availabilityPayload({ availability: 'Yes', availabilityLastReviewedOn: '2025-01-10' }, original)).toEqual({});
  });
  it('sends a review with its original availability so a stale form cannot review another answer', () => {
    expect(availabilityPayload({ availability: 'Yes', availabilityLastReviewedOn: '2025-01-15' }, original)).toEqual({
      availability: 'Yes', availabilityLastReviewedOn: '2025-01-15',
      expectedAvailability: { availability: 'Yes', availabilityLastReviewedOn: '2025-01-10' },
    });
  });
  it('distinguishes clearing a date from leaving it untouched', () => {
    expect(availabilityPayload({ availability: 'Yes', availabilityLastReviewedOn: '' }, original).availabilityLastReviewedOn).toBeNull();
    expect(availabilityPayload({ availability: 'Yes', availabilityLastReviewedOn: '' }, null)).toEqual({ availability: 'Yes', availabilityLastReviewedOn: null });
  });
  it('suggests the India calendar day only for a Yes/No flip and restores the original on reversal', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2025-12-31T18:30:00Z'));
    expect(suggestedReviewDate(original, 'No')).toBe('2026-01-01');
    expect(suggestedReviewDate(original, 'Yes')).toBe('2025-01-10');
    expect(suggestedReviewDate(original, ' yes ')).toBe('2025-01-10');
    expect(suggestedReviewDate({ availability: 'Immediate' }, 'Yes')).toBe('');
    expect(suggestedReviewDate(null, 'Yes')).toBe('');
  });
  it('keeps calendar dates stable and displays blanks as Not recorded', () => {
    expect(todayInIndia(new Date('2025-12-31T18:29:59Z'))).toBe('2025-12-31');
    expect(todayInIndia(new Date('2025-12-31T18:30:00Z'))).toBe('2026-01-01');
    expect(formatAvailabilityReview('2025-01-10T00:00:00Z')).toBe('10 Jan 2025');
    expect(formatAvailabilityReview(null)).toBe('Not recorded');
  });
});
