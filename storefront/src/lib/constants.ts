/**
 * Commercial and rendering constants. Anything a shop owner might plausibly
 * change without a code change belongs in Directus; anything that would change
 * the meaning of the code lives here.
 */

/** Polish standard VAT rate, as a fraction. All catalogue prices are net. */
export const VAT_RATE = 0.23;

export const CURRENCY = 'PLN';
export const CURRENCY_SYMBOL = 'zł';
export const LOCALE = 'pl-PL';

/** Rows per page in the product table. */
export const PRODUCTS_PER_PAGE = 25;

/**
 * How many units short of the next price bracket still earns a nudge.
 * Wide enough to catch "97 of 100" cases, narrow enough that the prompt does
 * not follow every buyer down the table.
 */
export const TIER_NUDGE_THRESHOLD = 5;

/** Days between proforma issue and the payment deadline printed on it. */
export const PAYMENT_TERM_DAYS = 7;

/** Prefix of generated order numbers: SO-2026-00001. */
export const ORDER_NUMBER_PREFIX = 'SO';

/**
 * Seller identity printed on the proforma. Deliberately fictional — this is a
 * portfolio project and must not appear to be a real trading entity.
 */
export const SELLER = {
  name: 'Solaris Components Sp. z o.o.',
  address: 'ul. Przykładowa 12',
  postalCode: '00-001',
  city: 'Warszawa',
  country: 'Polska',
  nip: '5252445767',
  email: 'orders@example.com',
  phone: '+48 22 000 00 00',
} as const;

/** Bank details for the manual transfer. Placeholder account number. */
export const BANK = {
  accountName: SELLER.name,
  iban: 'PL61 1090 1014 0000 0712 1981 2874',
  swift: 'WBKPPLPP',
  bankName: 'Bank Przykładowy S.A.',
} as const;

/** The only payment method offered; there is no online gateway. */
export const PAYMENT_METHOD = 'bank_transfer' as const;
