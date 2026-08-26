import { describe, expect, it } from 'vitest';

import {
  EMPTY_CHECKOUT,
  isValidCheckout,
  normalizeCheckout,
  validateCheckout,
  type CheckoutInput,
} from '@/lib/checkout';
import {
  formatOrderNumber,
  nextOrderNumber,
  parseOrderSequence,
} from '@/lib/order-number';

/**
 * Checkout validation runs in the browser for the buyer's benefit and on the
 * server for everyone else's. These tests pin the shared implementation, which
 * is what stops the two from disagreeing — a field the form accepts and the API
 * rejects is a dead end no user can get out of.
 */

/** A complete anonymous order that should pass. */
const validAnonymous: CheckoutInput = {
  ...EMPTY_CHECKOUT,
  deliveryName: 'Tomasz Lewandowski',
  deliveryAddress: 'ul. Krótka 4',
  deliveryCity: 'Wrocław',
  deliveryPostalCode: '50-004',
  deliveryPhone: '+48 604 000 004',
  deliveryEmail: 'tomasz@example.com',
  consent: true,
};

const validCompany: CheckoutInput = {
  ...validAnonymous,
  invoiceType: 'nip',
  companyName: 'Instalacje PV Kowalski Sp. z o.o.',
  nip: '123-456-32-18',
  companyAddress: 'ul. Instalatorska 8\n61-001 Poznań',
};

describe('validateCheckout — delivery', () => {
  it('accepts a complete anonymous order', () => {
    expect(validateCheckout(validAnonymous)).toEqual({});
    expect(isValidCheckout(validAnonymous)).toBe(true);
  });

  it('requires every delivery field', () => {
    const errors = validateCheckout(EMPTY_CHECKOUT);

    expect(errors.deliveryName).toBeDefined();
    expect(errors.deliveryAddress).toBeDefined();
    expect(errors.deliveryCity).toBeDefined();
    expect(errors.deliveryPostalCode).toBeDefined();
    expect(errors.deliveryPhone).toBeDefined();
    expect(errors.deliveryEmail).toBeDefined();
  });

  it('rejects whitespace-only values', () => {
    const errors = validateCheckout({ ...validAnonymous, deliveryName: '   ' });
    expect(errors.deliveryName).toBeDefined();
  });

  it('checks the postal code format', () => {
    expect(validateCheckout({ ...validAnonymous, deliveryPostalCode: '50004' }).deliveryPostalCode)
      .toBeDefined();
    expect(validateCheckout({ ...validAnonymous, deliveryPostalCode: '50-04' }).deliveryPostalCode)
      .toBeDefined();
    expect(validateCheckout({ ...validAnonymous, deliveryPostalCode: '50-004' }).deliveryPostalCode)
      .toBeUndefined();
  });

  it('accepts phone numbers with the punctuation people actually type', () => {
    for (const phone of ['+48 604 000 004', '604-000-004', '(604) 000 004', '604000004']) {
      expect(validateCheckout({ ...validAnonymous, deliveryPhone: phone }).deliveryPhone)
        .toBeUndefined();
    }
  });

  it('rejects a phone number that is too short to be one', () => {
    expect(validateCheckout({ ...validAnonymous, deliveryPhone: '12345' }).deliveryPhone)
      .toBeDefined();
  });

  it('checks the email shape', () => {
    for (const email of ['not-an-email', 'a@b', 'a b@example.com', '@example.com']) {
      expect(validateCheckout({ ...validAnonymous, deliveryEmail: email }).deliveryEmail)
        .toBeDefined();
    }
    expect(validateCheckout({ ...validAnonymous, deliveryEmail: 'a.b+c@example.co.uk' }).deliveryEmail)
      .toBeUndefined();
  });

  it('requires consent', () => {
    expect(validateCheckout({ ...validAnonymous, consent: false }).consent).toBeDefined();
  });
});

describe('validateCheckout — invoice type', () => {
  it('asks for nothing extra on an anonymous invoice', () => {
    const errors = validateCheckout(validAnonymous);
    expect(errors.companyName).toBeUndefined();
    expect(errors.nip).toBeUndefined();
    expect(errors.companyAddress).toBeUndefined();
  });

  it('accepts a complete company order', () => {
    expect(validateCheckout(validCompany)).toEqual({});
  });

  it('requires company fields once NIP is chosen', () => {
    const errors = validateCheckout({ ...validAnonymous, invoiceType: 'nip' });
    expect(errors.companyName).toBeDefined();
    expect(errors.nip).toBeDefined();
    expect(errors.companyAddress).toBeDefined();
  });

  it('distinguishes a missing NIP from a malformed one from a bad checksum', () => {
    const missing = validateCheckout({ ...validCompany, nip: '' }).nip!;
    const short = validateCheckout({ ...validCompany, nip: '12345' }).nip!;
    const badSum = validateCheckout({ ...validCompany, nip: '1234563219' }).nip!;

    expect(missing).toMatch(/required/i);
    expect(short).toMatch(/ten digits/i);
    expect(badSum).toMatch(/checksum/i);
  });

  it('rejects an unknown invoice type', () => {
    expect(
      validateCheckout({ ...validAnonymous, invoiceType: 'cash' as never }).invoiceType,
    ).toBeDefined();
  });
});

describe('normalizeCheckout', () => {
  it('trims, lowercases the email and reduces the NIP to bare digits', () => {
    const normalized = normalizeCheckout({
      ...validCompany,
      deliveryName: '  Tomasz  ',
      deliveryEmail: '  Tomasz@Example.COM ',
    });

    expect(normalized.delivery_name).toBe('Tomasz');
    expect(normalized.delivery_email).toBe('tomasz@example.com');
    expect(normalized.nip).toBe('1234563218');
  });

  it('nulls company fields on an anonymous invoice rather than storing blanks', () => {
    const normalized = normalizeCheckout({
      ...validCompany,
      invoiceType: 'anonymous',
    });

    expect(normalized.company_name).toBeNull();
    expect(normalized.nip).toBeNull();
    expect(normalized.company_address).toBeNull();
  });

  it('turns empty notes into null', () => {
    expect(normalizeCheckout({ ...validAnonymous, notes: '   ' }).notes).toBeNull();
    expect(normalizeCheckout({ ...validAnonymous, notes: ' ship am ' }).notes).toBe('ship am');
  });
});

describe('order numbers', () => {
  it('formats with a zero-padded sequence', () => {
    expect(formatOrderNumber(2026, 1)).toBe('SO-2026-00001');
    expect(formatOrderNumber(2026, 4213)).toBe('SO-2026-04213');
  });

  it('reads its own sequence back', () => {
    expect(parseOrderSequence('SO-2026-00042', 2026)).toBe(42);
    expect(parseOrderSequence('SO-2026-00042', 2025)).toBeNull();
    expect(parseOrderSequence('INV-2026-00042', 2026)).toBeNull();
    expect(parseOrderSequence('SO-2026-abc', 2026)).toBeNull();
  });

  it('continues from the highest issued number, not from a count', () => {
    // Counting would reissue 00003 after a deletion and collide on the
    // unique constraint.
    expect(nextOrderNumber(['SO-2026-00001', 'SO-2026-00003'], 2026)).toBe('SO-2026-00004');
  });

  it('starts a fresh sequence each year', () => {
    expect(nextOrderNumber(['SO-2025-00500'], 2026)).toBe('SO-2026-00001');
    expect(nextOrderNumber([], 2026)).toBe('SO-2026-00001');
  });

  it('ignores numbers it does not recognise', () => {
    expect(nextOrderNumber(['nonsense', 'SO-2026-00007'], 2026)).toBe('SO-2026-00008');
  });
});
