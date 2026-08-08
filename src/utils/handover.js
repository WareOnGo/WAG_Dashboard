// Handover timing is stored one of two ways (see the HandoverType enum in the Prisma
// schema): a precise calendar date (FIXED, in handoverDate), or a lead time relative
// to today (VARIABLE, in handoverLeadValue + handoverLeadUnit). Exactly one side is
// populated on any row — the backend nulls the other on write — so every surface that
// shows handover has to branch. Shared here so the dashboard table, the details modal
// and the form can't drift apart on wording.

/** Dropdown labels for the mode toggle, and their enum equivalents. */
export const HANDOVER_TYPE_OPTIONS = ['Fixed', 'Variable'];
export const HANDOVER_UNIT_OPTIONS = ['Days', 'Weeks', 'Months'];

export const handoverTypeToEnum = (label) => (label === 'Variable' ? 'VARIABLE' : 'FIXED');

/**
 * Enum -> dropdown label. Legacy rows written before handoverType existed come back
 * null and read as 'Fixed', which is what they effectively were.
 */
export const handoverTypeToLabel = (value) => (value === 'VARIABLE' ? 'Variable' : 'Fixed');

export const handoverUnitToEnum = (label) => (label ? String(label).toUpperCase() : null);

export const handoverUnitToLabel = (value) =>
  (value ? String(value).charAt(0) + String(value).slice(1).toLowerCase() : '');

const UNIT_NOUNS = { DAYS: 'day', WEEKS: 'week', MONTHS: 'month' };

/**
 * Render a lead time as "~2 months" / "~1 week".
 * @returns {string|null} null when the value/unit pair is incomplete or nonsensical.
 */
export const formatHandoverLead = (value, unit) => {
  const n = Number(value);
  const noun = UNIT_NOUNS[unit];
  if (!Number.isFinite(n) || n <= 0 || !noun) return null;
  return `~${n} ${noun}${n === 1 ? '' : 's'}`;
};

/**
 * Render a warehouse's handover timing, whichever way it's stored.
 * @param {Object} warehouse
 * @param {Function} formatDate - the caller's own date renderer, so each surface keeps
 *   the date format it already used (the table is terse, the modal is long-form).
 * @returns {string|null}
 */
export const formatHandover = (warehouse, formatDate) => {
  if (!warehouse) return null;
  if (warehouse.handoverType === 'VARIABLE') {
    return formatHandoverLead(warehouse.handoverLeadValue, warehouse.handoverLeadUnit);
  }
  return formatDate(warehouse.handoverDate);
};
