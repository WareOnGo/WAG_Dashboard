/**
 * Use-cases a warehouse suits — the options behind Warehouse.suitableFor.
 *
 * Stored as stable codes with the label kept here, the same arrangement as
 * waterSupply.js. Renaming a label is then a change in this file rather than a
 * data migration across every row that carries the old string.
 *
 * The backend validates submissions against the identical list
 * (warehouseValidator.SUITABLE_FOR); adding an option means editing both, plus
 * the copy in the Scout app.
 */
export const SUITABLE_FOR_OPTIONS = [
  { value: 'PHARMA', label: 'Pharma' },
  { value: 'FMCG', label: 'FMCG' },
  { value: 'FNB', label: 'FnB' },
  { value: 'RETAIL', label: 'Retail' },
  { value: 'ECOMMERCE', label: 'E-Commerce' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'TRANSSHIPMENT_COURIER', label: 'Transshipment/Courier' },
  { value: 'FACTORY_INDUSTRIAL', label: 'Factory/Industrial' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'DARK_STORE', label: 'Dark Store' },
];

const LABELS = Object.fromEntries(SUITABLE_FOR_OPTIONS.map((o) => [o.value, o.label]));

/**
 * Label for a stored code. Falls back to the raw value so a tag written by an
 * older or newer client still renders as something, rather than vanishing.
 *
 * @param {string} value
 * @returns {string}
 */
export const suitableForLabel = (value) => LABELS[value] || String(value ?? '');

/**
 * Labels for a stored array, for read-only display.
 * @param {string[]|null|undefined} values
 * @returns {string[]}
 */
export const suitableForLabels = (values) =>
  (Array.isArray(values) ? values : []).map(suitableForLabel);
