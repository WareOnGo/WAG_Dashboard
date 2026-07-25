/**
 * Contact-number reveals are audit-logged with the reason the caller gives, so a reason
 * is required. These bounds mirror validationMiddleware.validateContactReveal on the
 * backend, which rejects anything outside them.
 */
export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 280;

/**
 * Reason recorded when the app reveals a number for a record edit rather than for a deal.
 * The edit form has to prefill the real number or saving would wipe it, so there is no
 * human to prompt — the audit entry says so instead of implying a deal.
 */
export const EDIT_PREFILL_REASON = 'Opened warehouse record for editing';
