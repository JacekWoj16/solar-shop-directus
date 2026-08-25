import { describe, expect, it } from 'vitest';

import {
  DECIMAL_SEPARATOR,
  THOUSANDS_SEPARATOR,
  formatDate,
  formatNumber,
  formatPercent,
  formatPostalCode,
  formatPrice,
  formatPriceLong,
  formatQuantity,
  formatTierRange,
  roundMoney,
} from '@/lib/format';

/**
 * Polish formatting is implemented by hand rather than through `Intl`, because
 * the same helpers render HTML in the browser, HTML on the server and text
 * inside the proforma PDF, and `Intl` output varies with the host's ICU build.
 * These tests pin the convention: a no-break space between thousands, a comma
 * before the grosze.
 */

const NBSP = ' ';

describe('separators', () => {
  it('uses a no-break space and a comma', () => {
    expect(THOUSANDS_SEPARATOR).toBe(NBSP);
    expect(DECIMAL_SEPARATOR).toBe(',');
  });
});

describe('roundMoney', () => {
  it('rounds to whole grosze', () => {
    expect(roundMoney(346.499)).toBe(346.5);
    expect(roundMoney(346.494)).toBe(346.49);
  });

  it('rounds up values that are exact in decimal but not in binary', () => {
    // Each of these scales to just under the halfway point in binary:
    // 1.005 * 100 = 100.49999999999999, 8.165 * 100 = 816.4999999999999.
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(8.165)).toBe(8.17);
    expect(roundMoney(0.145)).toBe(0.15);
    expect(roundMoney(1234.565)).toBe(1234.57);
  });

  it('rounds half away from zero, so credits mirror charges', () => {
    expect(roundMoney(-8.165)).toBe(-8.17);
    expect(roundMoney(-0.005)).toBe(-0.01);
  });

  it('returns zero for non-finite input', () => {
    expect(roundMoney(Number.NaN)).toBe(0);
    expect(roundMoney(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('stays exact across the magnitudes a B2B order reaches', () => {
    expect(roundMoney(286523.4)).toBe(286523.4);
    expect(roundMoney(304.92 * 540)).toBe(164656.8);
    expect(roundMoney(1_234_567.891)).toBe(1234567.89);
  });

  it('handles the products of price by quantity without drift', () => {
    expect(roundMoney(274.54 * 3)).toBe(823.62);
    expect(roundMoney(332.64 * 50)).toBe(16632);
  });
});

describe('formatNumber', () => {
  it('groups thousands and uses a decimal comma', () => {
    expect(formatNumber(1732.5)).toBe(`1${NBSP}732,50`);
    expect(formatNumber(286523.4)).toBe(`286${NBSP}523,40`);
    expect(formatNumber(1234567.89)).toBe(`1${NBSP}234${NBSP}567,89`);
  });

  it('does not group numbers below a thousand', () => {
    expect(formatNumber(346.5)).toBe('346,50');
    expect(formatNumber(0)).toBe('0,00');
  });

  it('honours a custom precision, including zero', () => {
    expect(formatNumber(1732.5, 0)).toBe(`1${NBSP}733`);
    expect(formatNumber(0.235, 3)).toBe('0,235');
  });

  it('keeps a leading minus outside the grouping', () => {
    expect(formatNumber(-1732.5)).toBe(`-1${NBSP}732,50`);
  });

  it('renders non-finite input as zero rather than "NaN"', () => {
    expect(formatNumber(Number.NaN)).toBe('0,00');
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe('0,00');
  });
});

describe('formatPrice', () => {
  it('appends the currency after a no-break space', () => {
    expect(formatPrice(1732.5)).toBe(`1${NBSP}732,50${NBSP}zł`);
    expect(formatPriceLong(1732.5)).toBe(`1${NBSP}732,50${NBSP}PLN`);
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a percentage', () => {
    expect(formatPercent(0.23)).toBe('23%');
    expect(formatPercent(0.051, 1)).toBe('5,1%');
  });
});

describe('formatQuantity', () => {
  it('renders whole units with the Polish abbreviation', () => {
    expect(formatQuantity(12)).toBe(`12${NBSP}szt.`);
    expect(formatQuantity(1500)).toBe(`1${NBSP}500${NBSP}szt.`);
    expect(formatQuantity(10, 'm')).toBe(`10${NBSP}m`);
  });
});

describe('formatTierRange', () => {
  it('renders a bounded bracket as a range', () => {
    expect(formatTierRange(5, 49)).toBe('5–49');
    expect(formatTierRange(200, 499)).toBe('200–499');
  });

  it('renders the open-ended top bracket with a plus', () => {
    expect(formatTierRange(500, null)).toBe('500+');
  });

  it('collapses a single-quantity bracket', () => {
    expect(formatTierRange(1, 1)).toBe('1');
  });

  it('groups thousands inside a bracket', () => {
    expect(formatTierRange(1000, null)).toBe(`1${NBSP}000+`);
  });
});

describe('formatDate', () => {
  it('renders the invoice date format', () => {
    expect(formatDate('2026-08-25T18:30:00.000Z')).toBe('2026-08-25');
    expect(formatDate(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatDate('not a date')).toBe('');
  });
});

describe('formatPostalCode', () => {
  it('inserts the dash', () => {
    expect(formatPostalCode('00001')).toBe('00-001');
    expect(formatPostalCode('00 001')).toBe('00-001');
    expect(formatPostalCode('00-001')).toBe('00-001');
  });

  it('leaves partial input usable while typing', () => {
    expect(formatPostalCode('0')).toBe('0');
    expect(formatPostalCode('00')).toBe('00');
    expect(formatPostalCode('000')).toBe('00-0');
  });

  it('discards anything past five digits', () => {
    expect(formatPostalCode('001234567')).toBe('00-123');
  });
});
