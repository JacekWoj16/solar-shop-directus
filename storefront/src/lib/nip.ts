/**
 * Polish tax identification number (NIP) handling.
 *
 * A NIP is ten digits with a weighted modulo-11 checksum, so a typo is caught
 * before the order reaches the accountant rather than after the proforma has
 * been sent. Validation is intentionally split from formatting: the checkout
 * form stores whatever the buyer typed and only normalises on submit.
 */

/** Weights applied to the first nine digits of the checksum calculation. */
const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

export type NipError = 'empty' | 'length' | 'characters' | 'checksum';

export interface NipValidation {
  valid: boolean;
  /** The ten bare digits, or `null` when they could not be extracted. */
  normalized: string | null;
  error: NipError | null;
}

/**
 * Strips the optional `PL` prefix and any spaces, dots or dashes.
 * `"PL 123-456-32-18"` → `"1234563218"`.
 */
export function normalizeNip(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/^PL/, '')
    .replace(/[\s.\-_]/g, '');
}

/** Ten digits and nothing else. Does not check the checksum. */
export function hasValidNipFormat(input: string): boolean {
  return /^\d{10}$/.test(normalizeNip(input));
}

/**
 * Verifies the modulo-11 checksum of ten already-normalised digits.
 * A remainder of 10 cannot be represented by a single digit, so such a number
 * is never issued and is treated as invalid.
 */
function hasValidNipChecksum(digits: string): boolean {
  const checkDigit = Number(digits[9]);

  const sum = NIP_WEIGHTS.reduce(
    (total, weight, index) => total + weight * Number(digits[index]),
    0,
  );

  const remainder = sum % 11;
  return remainder !== 10 && remainder === checkDigit;
}

/** Full validation with a machine-readable reason, for form-level messages. */
export function validateNip(input: string): NipValidation {
  const normalized = normalizeNip(input);

  if (normalized.length === 0) {
    return { valid: false, normalized: null, error: 'empty' };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, normalized: null, error: 'characters' };
  }
  if (normalized.length !== 10) {
    return { valid: false, normalized, error: 'length' };
  }
  if (!hasValidNipChecksum(normalized)) {
    return { valid: false, normalized, error: 'checksum' };
  }

  return { valid: true, normalized, error: null };
}

/** Convenience predicate over `validateNip`. */
export function isValidNip(input: string): boolean {
  return validateNip(input).valid;
}

/**
 * Renders a NIP in the conventional grouping: `1234563218` → `123-456-32-18`.
 * Input that is not ten digits is returned trimmed and unchanged, so a
 * half-typed value is not mangled while the buyer is still typing.
 */
export function formatNip(input: string): string {
  const normalized = normalizeNip(input);
  if (!/^\d{10}$/.test(normalized)) return input.trim();

  return [
    normalized.slice(0, 3),
    normalized.slice(3, 6),
    normalized.slice(6, 8),
    normalized.slice(8, 10),
  ].join('-');
}
