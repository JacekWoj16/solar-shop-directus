import type { InvoiceType } from '@/types/order';

import { validateNip } from './nip';

/**
 * Checkout validation.
 *
 * One pure function, used by both the form and the order route. The browser
 * copy exists so a buyer is told about a mistyped NIP before they submit; the
 * server copy exists because the browser copy can be skipped entirely. Sharing
 * the implementation is what keeps them from disagreeing — a field the form
 * accepts and the API rejects is a dead end no user can get out of.
 */

/** Raw form state. Everything is a string; parsing happens here. */
export interface CheckoutInput {
  invoiceType: InvoiceType;
  companyName: string;
  nip: string;
  companyAddress: string;
  deliveryName: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryPhone: string;
  deliveryEmail: string;
  notes: string;
  consent: boolean;
}

export type CheckoutField = keyof CheckoutInput;

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

export const EMPTY_CHECKOUT: CheckoutInput = {
  invoiceType: 'anonymous',
  companyName: '',
  nip: '',
  companyAddress: '',
  deliveryName: '',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryPostalCode: '',
  deliveryPhone: '',
  deliveryEmail: '',
  notes: '',
  consent: false,
};

/**
 * Pragmatic rather than exhaustive: there is no regex that matches exactly the
 * set of deliverable addresses, and a stricter one mostly rejects real people.
 * The bounce, if any, is caught by a human reading the order.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Polish postal codes are `NN-NNN`. */
const POSTAL_CODE_PATTERN = /^\d{2}-\d{3}$/;

/** Digits only, after stripping the formatting people actually type. */
function phoneDigits(value: string): string {
  return value.replace(/[\s\-()+.]/g, '');
}

export function validateCheckout(input: CheckoutInput): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const trimmed = (value: string) => value.trim();

  // --- Invoice details -----------------------------------------------------
  if (input.invoiceType !== 'anonymous' && input.invoiceType !== 'nip') {
    errors.invoiceType = 'Choose an invoice type.';
  }

  if (input.invoiceType === 'nip') {
    if (!trimmed(input.companyName)) {
      errors.companyName = 'Company name is required for a NIP invoice.';
    }
    if (!trimmed(input.companyAddress)) {
      errors.companyAddress = 'Company address is required for a NIP invoice.';
    }

    const nip = validateNip(input.nip);
    if (!nip.valid) {
      errors.nip =
        nip.error === 'empty'
          ? 'NIP is required for a NIP invoice.'
          : nip.error === 'checksum'
            ? 'That NIP fails its checksum — please re-check the digits.'
            : 'A NIP is ten digits, e.g. 123-456-32-18.';
    }
  }

  // --- Delivery, always required ------------------------------------------
  if (!trimmed(input.deliveryName)) {
    errors.deliveryName = 'Recipient name is required.';
  }
  if (!trimmed(input.deliveryAddress)) {
    errors.deliveryAddress = 'Street and building number are required.';
  }
  if (!trimmed(input.deliveryCity)) {
    errors.deliveryCity = 'City is required.';
  }

  if (!trimmed(input.deliveryPostalCode)) {
    errors.deliveryPostalCode = 'Postal code is required.';
  } else if (!POSTAL_CODE_PATTERN.test(trimmed(input.deliveryPostalCode))) {
    errors.deliveryPostalCode = 'Use the format 00-001.';
  }

  const phone = phoneDigits(input.deliveryPhone);
  if (!phone) {
    errors.deliveryPhone = 'Phone number is required — couriers call before delivery.';
  } else if (phone.length < 9) {
    errors.deliveryPhone = 'That phone number looks too short.';
  }

  if (!trimmed(input.deliveryEmail)) {
    errors.deliveryEmail = 'Email is required — the proforma is sent there.';
  } else if (!EMAIL_PATTERN.test(trimmed(input.deliveryEmail))) {
    errors.deliveryEmail = 'That does not look like an email address.';
  }

  // --- Consent -------------------------------------------------------------
  if (!input.consent) {
    errors.consent = 'Please accept the terms to place the order.';
  }

  return errors;
}

export function isValidCheckout(input: CheckoutInput): boolean {
  return Object.keys(validateCheckout(input)).length === 0;
}

/**
 * Normalises validated input for storage: trims everything, and reduces the NIP
 * to bare digits so the column holds one canonical form regardless of how it
 * was typed. Company fields are nulled out for anonymous invoices rather than
 * stored as empty strings — the absence is the meaningful part.
 */
export function normalizeCheckout(input: CheckoutInput) {
  const isCompany = input.invoiceType === 'nip';

  return {
    invoice_type: input.invoiceType,
    company_name: isCompany ? input.companyName.trim() : null,
    nip: isCompany ? validateNip(input.nip).normalized : null,
    company_address: isCompany ? input.companyAddress.trim() : null,
    delivery_name: input.deliveryName.trim(),
    delivery_address: input.deliveryAddress.trim(),
    delivery_city: input.deliveryCity.trim(),
    delivery_postal_code: input.deliveryPostalCode.trim(),
    delivery_phone: input.deliveryPhone.trim(),
    delivery_email: input.deliveryEmail.trim().toLowerCase(),
    notes: input.notes.trim() || null,
  };
}
