import { CURRENCY_SYMBOL } from './constants';

/**
 * Polish number and money formatting.
 *
 * These are implemented by hand rather than with `Intl.NumberFormat` on
 * purpose: the same helpers run in React Server Components, in the browser and
 * inside the proforma PDF renderer, and `Intl` output varies with the ICU build
 * of the host (Vercel's runtime, a slim Docker image, a contributor's Node).
 * Column alignment in a printed invoice is not something to leave to the
 * environment. The Polish convention is a narrow no-break space between
 * thousands and a comma before the grosze.
 */

/** U+00A0 — keeps "1 732,50 zł" from wrapping mid-number. */
export const THOUSANDS_SEPARATOR = ' ';
export const DECIMAL_SEPARATOR = ',';

/**
 * Rounds to whole grosze. The epsilon nudge keeps values that are exact in
 * decimal but not in binary (0.145, 1.005) from rounding down.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** `1732.5` → `"1 732,50"`. Negative values keep a leading minus. */
export function formatNumber(value: number, fractionDigits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? '-' : '';
  const fixed = Math.abs(safe).toFixed(fractionDigits);
  const [whole = '0', fraction] = fixed.split('.');

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEPARATOR);

  return fraction
    ? `${sign}${grouped}${DECIMAL_SEPARATOR}${fraction}`
    : `${sign}${grouped}`;
}

/** `1732.5` → `"1 732,50 zł"`. */
export function formatPrice(value: number): string {
  return `${formatNumber(value)}${THOUSANDS_SEPARATOR}${CURRENCY_SYMBOL}`;
}

/** `1732.5` → `"1 732,50 PLN"` — the longer form used on the proforma. */
export function formatPriceLong(value: number): string {
  return `${formatNumber(value)}${THOUSANDS_SEPARATOR}PLN`;
}

/** `0.23` → `"23%"`. */
export function formatPercent(fraction: number, fractionDigits = 0): string {
  return `${formatNumber(fraction * 100, fractionDigits)}%`;
}

/** `12` → `"12 szt."` — the unit shown next to every quantity. */
export function formatQuantity(quantity: number, unit = 'szt.'): string {
  return `${formatNumber(quantity, 0)}${THOUSANDS_SEPARATOR}${unit}`;
}

/**
 * Renders a tier bracket the way the volume-pricing table does:
 * `5–99`, or `500+` for the open-ended top bracket.
 */
export function formatTierRange(
  minQuantity: number,
  maxQuantity: number | null,
): string {
  if (maxQuantity === null) return `${formatNumber(minQuantity, 0)}+`;
  if (maxQuantity === minQuantity) return formatNumber(minQuantity, 0);
  return `${formatNumber(minQuantity, 0)}–${formatNumber(maxQuantity, 0)}`;
}

/** ISO timestamp → `"2026-08-25"`, the format used on invoices. */
export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

/** Postal code entered as `00001` or `00 001` → `"00-001"`. */
export function formatPostalCode(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 5);
  return digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
}
