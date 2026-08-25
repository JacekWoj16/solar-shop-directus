import { describe, expect, it } from 'vitest';

import { SELLER } from '@/lib/constants';
import {
  formatNip,
  hasValidNipFormat,
  isValidNip,
  normalizeNip,
  validateNip,
} from '@/lib/nip';

/** Numbers whose modulo-11 checksum is correct. */
const VALID = ['1234563218', '5252445767', '8461627563', '5260000011'];

describe('normalizeNip', () => {
  it('strips separators, whitespace and the PL prefix', () => {
    expect(normalizeNip('123-456-32-18')).toBe('1234563218');
    expect(normalizeNip(' 123 456 32 18 ')).toBe('1234563218');
    expect(normalizeNip('PL1234563218')).toBe('1234563218');
    expect(normalizeNip('pl 123-456-32-18')).toBe('1234563218');
    expect(normalizeNip('123.456.32.18')).toBe('1234563218');
  });

  it('leaves unexpected characters in place for the validator to reject', () => {
    expect(normalizeNip('12A4563218')).toBe('12A4563218');
  });
});

describe('hasValidNipFormat', () => {
  it('accepts exactly ten digits in any separator style', () => {
    expect(hasValidNipFormat('1234567890')).toBe(true);
    expect(hasValidNipFormat('123-456-78-90')).toBe(true);
  });

  it('rejects anything that is not ten digits', () => {
    expect(hasValidNipFormat('123456789')).toBe(false);
    expect(hasValidNipFormat('12345678901')).toBe(false);
    expect(hasValidNipFormat('')).toBe(false);
    expect(hasValidNipFormat('abcdefghij')).toBe(false);
  });
});

describe('validateNip', () => {
  it.each(VALID)('accepts %s', (nip) => {
    const result = validateNip(nip);
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe(nip);
    expect(result.error).toBeNull();
  });

  it('accepts a formatted number and returns bare digits', () => {
    expect(validateNip('123-456-32-18').normalized).toBe('1234563218');
  });

  it('rejects a wrong check digit', () => {
    const result = validateNip('1234563219');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('checksum');
  });

  it('rejects a number whose weighted sum leaves a remainder of 10', () => {
    // 1234567890 sums to remainder 10, which no issued NIP can carry.
    const result = validateNip('1234567890');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('checksum');
  });

  it('reports an empty value distinctly from a malformed one', () => {
    expect(validateNip('').error).toBe('empty');
    expect(validateNip('   ').error).toBe('empty');
    expect(validateNip('PL').error).toBe('empty');
  });

  it('reports non-digit characters', () => {
    expect(validateNip('12A4563218').error).toBe('characters');
  });

  it('reports the wrong number of digits', () => {
    expect(validateNip('123456321').error).toBe('length');
    expect(validateNip('12345632188').error).toBe('length');
  });
});

describe('isValidNip', () => {
  it('mirrors validateNip', () => {
    expect(isValidNip('123-456-32-18')).toBe(true);
    expect(isValidNip('1234563219')).toBe(false);
  });

  it('accepts the seller NIP printed on every proforma', () => {
    expect(isValidNip(SELLER.nip)).toBe(true);
  });
});

describe('formatNip', () => {
  it('groups ten digits as 3-3-2-2', () => {
    expect(formatNip('1234563218')).toBe('123-456-32-18');
    expect(formatNip('PL 1234563218')).toBe('123-456-32-18');
  });

  it('leaves partial input alone so typing is not disrupted', () => {
    expect(formatNip('12345')).toBe('12345');
    expect(formatNip(' 123456 ')).toBe('123456');
    expect(formatNip('')).toBe('');
  });
});
