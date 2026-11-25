import { initialReview, snapshotWarehouse } from '../aiQaReviewDraft';
import { getMediaFromWarehouse, imageVariant } from '../../../utils/mediaUtils';
import { formatValue } from '../values';

it('keeps bare QA snapshot measurements unitless while retaining normal review formatting', () => {
  for (const key of ['warehouseData.powerKva', 'floorStrengthPerSqm', 'gateSizeFt']) {
    expect(formatValue('5', { key, preserveRecordedUnits: true })).toBe('5');
    expect(formatValue('5', { key })).not.toBe('5');
  }
  expect(formatValue('5 HP', { key: 'warehouseData.powerKva', preserveRecordedUnits: true })).toBe('5 HP');
  expect(formatValue(false, { preserveRecordedUnits: true })).toBe('No');
});

it('preserves the standard warehouse media contract without replacing captured QA values', () => {
  const context = {
    id: 354,
    city: 'Current city',
    contactPerson: 'Warehouse contact',
    media: { images: ['https://media.example/original.jpg'], videos: [], docs: [] },
    images: [
      { originalUrl: 'https://media.example/original.jpg', jpegUrl: 'https://media.example/preview.jpg' }
    ],
    imageLabels: { 'https://media.example/original.jpg': { classification: 'INDOOR' } },
    WarehouseData: { powerKva: '400 kVA', latitude: 12.9 }
  };
  const row = {
    warehouse_id: 354,
    fields: {
      city: 'Reviewed city',
      'warehouseData.powerKva': '250',
      availabilityReview: { availability: 'Yes', availabilityLastReviewedOn: '2026-11-24' }
    }
  };
  const before = structuredClone(context);
  const warehouse = snapshotWarehouse(row, context);
  expect(warehouse).toMatchObject({
    city: 'Reviewed city',
    contactPerson: 'Warehouse contact',
    availability: 'Yes',
    WarehouseData: { powerKva: '250', latitude: 12.9 }
  });
  expect(getMediaFromWarehouse(warehouse).images).toEqual(['https://media.example/original.jpg']);
  expect(imageVariant(warehouse.images, 'https://media.example/original.jpg')).toBe(
    'https://media.example/preview.jpg'
  );
  expect(warehouse.imageLabels).toEqual(context.imageLabels);
  expect(context).toEqual(before);
});

it('keeps the standard legacy-photo fallback and tolerates a snapshot without context', () => {
  const row = { warehouse_id: 354, fields: { 'warehouseData.powerKva': null } };
  const warehouse = snapshotWarehouse(row, { photos: 'https://media.example/legacy.jpg' });
  expect(getMediaFromWarehouse(warehouse).images).toEqual(['https://media.example/legacy.jpg']);
  expect(snapshotWarehouse(row)).toMatchObject({ id: 354, WarehouseData: { powerKva: null } });
});

it('prefills readable server suggestions while preserving saved notes and rejection feedback', () => {
  const candidate = {
    field_key: 'flooringType',
    decision: 'PENDING',
    admin_note: '',
    suggested_note: 'Flooring Type is missing. Please add it.',
    findings: [{ explanation: 'A required answer is blank or is an exact placeholder.' }]
  };
  const draft = (changes = {}) => initialReview({ candidates: [{ ...candidate, ...changes }] }).flooringType;
  expect(draft().note).toBe(candidate.suggested_note);
  expect(draft({ admin_note: 'My saved note.' }).note).toBe('My saved note.');
  expect(
    draft({ decision: 'REJECTED', admin_note: 'This flag is incorrect.', decision_reason: 'INCORRECT' })
  ).toMatchObject({ selected: false, rejectionNote: 'This flag is incorrect.', reason: 'INCORRECT' });
});
