import { expect, test } from 'vitest';
import { withDefaultUnit } from './measurementDisplay';
test.each([
  ['30', 'ft', '30 ft'], ['0', 'kVA', '0 kVA'], [null, 'ft', null], ['', 'ft', ''],
  ['10 metres', 'ft', '10 metres'], ['50 feet', 'ft', '50 feet'], ['100 HP', 'kVA', '100 HP'],
  ['As per requirement', 'kVA', 'As per requirement'],
  ['To be confirmed', 'tonnes/sq m', 'To be confirmed'],
  ['100 kVA', 'kVA', '100 kVA'], ['20–30 feet', 'ft', '20–30 feet'],
])('displays %s without duplicating or changing units', (value, unit, expected) => {
  expect(withDefaultUnit(value, unit)).toBe(expected);
});
