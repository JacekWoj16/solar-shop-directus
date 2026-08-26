import { ORDER_NUMBER_PREFIX } from './constants';

/**
 * Order numbers: `SO-2026-00001`.
 *
 * The number is the buyer-facing reference and doubles as the bank transfer
 * title, so it has to be short enough to retype into a banking form and
 * meaningful enough to file. It restarts each year, which is how Polish
 * accounting numbers work.
 */

const SEQUENCE_DIGITS = 5;

export function orderNumberPrefix(year: number): string {
  return `${ORDER_NUMBER_PREFIX}-${year}-`;
}

export function formatOrderNumber(year: number, sequence: number): string {
  return `${orderNumberPrefix(year)}${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

/**
 * Reads the sequence back out of a number, or `null` if it is not one of ours.
 * Used to derive the next sequence from the highest existing number rather than
 * from a count, which would repeat a number after any deletion.
 */
export function parseOrderSequence(orderNumber: string, year: number): number | null {
  const prefix = orderNumberPrefix(year);
  if (!orderNumber.startsWith(prefix)) return null;

  const sequence = Number(orderNumber.slice(prefix.length));
  return Number.isInteger(sequence) && sequence > 0 ? sequence : null;
}

/** The next number for a year, given the numbers already issued in it. */
export function nextOrderNumber(existing: string[], year: number): string {
  const highest = existing.reduce((max, orderNumber) => {
    const sequence = parseOrderSequence(orderNumber, year);
    return sequence !== null && sequence > max ? sequence : max;
  }, 0);

  return formatOrderNumber(year, highest + 1);
}
