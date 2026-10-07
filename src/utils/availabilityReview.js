export const reviewDateValue = value => value ? String(value).slice(0, 10) : '';

export const todayInIndia = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export const formatAvailabilityReview = value => {
  const day = reviewDateValue(value);
  if (!day) return 'Not recorded';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(`${day}T00:00:00Z`));
};

export const suggestedReviewDate = (original, availability) => {
  const before = original?.availability?.trim().toLowerCase() || '';
  const after = availability?.trim().toLowerCase() || '';
  if (before === after) return reviewDateValue(original?.availabilityLastReviewedOn);
  return ['yes', 'no'].includes(before) && ['yes', 'no'].includes(after) ? todayInIndia() : '';
};

// Send the pair only when edited. The original pair is a narrow save condition;
// it must stay fixed even if other form data is fetched in the background.
export const availabilityPayload = (values, original) => {
  const availability = values.availability || null;
  const availabilityLastReviewedOn = values.availabilityLastReviewedOn || null;
  if (!original) return { availability, availabilityLastReviewedOn };
  const expectedAvailability = {
    availability: original.availability ?? null,
    availabilityLastReviewedOn: reviewDateValue(original.availabilityLastReviewedOn) || null,
  };
  if (availability === expectedAvailability.availability
    && availabilityLastReviewedOn === expectedAvailability.availabilityLastReviewedOn) return {};
  return { availability, availabilityLastReviewedOn, expectedAvailability };
};
