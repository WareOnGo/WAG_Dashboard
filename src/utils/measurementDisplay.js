// Bare legacy numbers used the field's historical unit. Explicit units and
// descriptions already carry meaning and must never get a second suffix.
export function withDefaultUnit(value, unit) {
  if (value == null || value === '') return value;
  const text = String(value).trim();
  return /^\d+(?:\.\d+)?$/.test(text) ? `${text} ${unit}` : text;
}
