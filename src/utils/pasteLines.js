/**
 * Multi-line or tab-separated clipboard text joined into one line with ", ".
 *
 * Search boxes are single-line inputs, and browsers flatten pasted line breaks
 * differently (some drop them, gluing "412\n87" into "41287"). Joining first
 * keeps every pasted value separate: a spreadsheet column of IDs becomes an ID
 * list, and a column of phone numbers stays separate numbers.
 * @param {string} text - clipboard text
 * @returns {string|null} the joined line, or null when there was nothing to join
 */
export function joinPastedLines(text) {
  if (!/[\r\n\t]/.test(text)) return null;
  return text.split(/[\r\n\t]+/).map((part) => part.trim()).filter(Boolean).join(', ');
}

/**
 * onPaste handler for a controlled search input: replaces the selection with
 * the joined paste, or leaves a single-line paste alone.
 * @param {ClipboardEvent} event
 * @param {string} value - the input's current value
 * @param {(next: string) => void} setValue
 */
export function pasteAsOneLine(event, value, setValue) {
  const line = joinPastedLines(event.clipboardData?.getData('text') ?? '');
  if (line === null) return;
  event.preventDefault();
  const start = event.target.selectionStart ?? value.length;
  const end = event.target.selectionEnd ?? value.length;
  setValue(value.slice(0, start) + line + value.slice(end));
}
