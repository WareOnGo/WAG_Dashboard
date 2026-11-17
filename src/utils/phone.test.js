import { describe, it, expect } from 'vitest';
import { looksLikePhone } from './phone';

describe('looksLikePhone — soft phone-number validation', () => {
  it.each([
    '9876543210',          // plain 10-digit mobile
    '98765 43210',         // mobile with whitespace
    '987 654 3210',        // mobile with multiple spaces
    '+91 98765 43210',     // +91 prefix with whitespace
    '+919876543210',       // +91 prefix, no spaces
    '919876543210',        // 91 prefix, no plus
    '098765 43210',        // leading 0 trunk prefix
    '080 2345 6789',       // landline with STD code
    '022-2345-6789',       // landline with dashes
    '(080) 23456789',      // landline with parens
    '  9876543210  ',      // surrounding whitespace
    '',                    // empty — handled by required-field check
    null,                  // nullish input is tolerated
    undefined,
  ])('accepts %p', (val) => {
    expect(looksLikePhone(val)).toBe(true);
  });

  it.each([
    'abcdefghij',          // letters
    '98765',               // too short
    '123',                 // way too short
    '9876543210123456',    // far too long
    'call me maybe',       // free text
    '98765abcde',          // mixed digits + letters
    '!!!!!!!!!!',          // punctuation only
  ])('flags %p as suspicious', (val) => {
    expect(looksLikePhone(val)).toBe(false);
  });
});
