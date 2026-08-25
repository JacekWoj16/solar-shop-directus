import type { CartCalculation, CartItem, CartLine } from '@/types/cart';
import type { PriceTier, TierNudge } from '@/types/product';

import { TIER_NUDGE_THRESHOLD, VAT_RATE } from './constants';
import { roundMoney } from './format';

/**
 * Volume pricing.
 *
 * This is the load-bearing business logic of the store: every price shown in
 * the product table, the cart and the proforma comes from `resolveTier`. The
 * rules are deliberately forgiving about imperfect data, because tiers are
 * hand-maintained by a shop owner in the Directus admin and will eventually
 * contain gaps, overlaps and out-of-order rows.
 */

/** Ascending by `min_quantity`; ties broken by `sort_order`. Non-mutating. */
export function sortTiers(tiers: readonly PriceTier[]): PriceTier[] {
  return [...tiers].sort(
    (a, b) => a.min_quantity - b.min_quantity || a.sort_order - b.sort_order,
  );
}

/** Coerces any user- or API-supplied quantity to a positive integer. */
function normalizeRequestedQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.floor(quantity));
}

/**
 * Finds the tier that applies to `quantity`.
 *
 * Resolution order:
 *  1. A bracket that literally contains the quantity.
 *  2. Below every bracket → the entry (cheapest-quantity) bracket. A category
 *     minimum can be lowered after tiers were authored; the buyer should still
 *     see a price rather than "contact us".
 *  3. Above every bracket → the highest bracket, i.e. the best price already
 *     earned. This also covers a bounded top tier (`1–10` with no successor),
 *     where quantity 50 keeps the 1–10 price instead of falling through.
 *
 * Returns `null` only when the product genuinely has no tiers.
 */
export function resolveTier(
  tiers: readonly PriceTier[],
  quantity: number,
): PriceTier | null {
  const sorted = sortTiers(tiers);
  if (sorted.length === 0) return null;

  const qty = normalizeRequestedQuantity(quantity);

  const containing = sorted.find(
    (tier) =>
      qty >= tier.min_quantity &&
      (tier.max_quantity === null || qty <= tier.max_quantity),
  );
  if (containing) return containing;

  const first = sorted[0]!;
  if (qty < first.min_quantity) return first;

  // Past the end, or inside a gap between brackets: the last bracket the
  // quantity has cleared wins.
  let applicable = first;
  for (const tier of sorted) {
    if (tier.min_quantity <= qty) applicable = tier;
  }
  return applicable;
}

/**
 * Net unit price for a quantity, or `null` when the product has no tiers —
 * callers render "Cena na zapytanie" (contact for price) instead of `0`.
 */
export function getUnitPrice(
  tiers: readonly PriceTier[],
  quantity: number,
): number | null {
  return resolveTier(tiers, quantity)?.unit_price ?? null;
}

/**
 * The price shown before a buyer has chosen a quantity: the entry bracket,
 * which is always the most expensive per unit.
 */
export function getEntryPrice(tiers: readonly PriceTier[]): number | null {
  return sortTiers(tiers)[0]?.unit_price ?? null;
}

/** The best per-unit price the product can reach at any quantity. */
export function getBestPrice(tiers: readonly PriceTier[]): number | null {
  if (tiers.length === 0) return null;
  return tiers.reduce(
    (best, tier) => Math.min(best, tier.unit_price),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * The saving available from rounding a quantity up to the next bracket, when
 * that bracket is within `threshold` units and actually cheaper.
 *
 * Returns `null` when the buyer is already on the best tier, when the next
 * bracket is too far away to be a useful prompt, or when the "next" bracket
 * is not cheaper (a mis-authored tier table should never advertise a loss).
 */
export function getNextTierNudge(
  tiers: readonly PriceTier[],
  quantity: number,
  threshold: number = TIER_NUDGE_THRESHOLD,
): TierNudge | null {
  const sorted = sortTiers(tiers);
  if (sorted.length < 2) return null;

  const qty = normalizeRequestedQuantity(quantity);
  const current = resolveTier(sorted, qty);
  if (!current) return null;

  const next = sorted.find(
    (tier) => tier.min_quantity > qty && tier.unit_price < current.unit_price,
  );
  if (!next) return null;

  const unitsNeeded = next.min_quantity - qty;
  if (unitsNeeded <= 0 || unitsNeeded > threshold) return null;

  const savingPerUnit = roundMoney(current.unit_price - next.unit_price);
  const savingPercent =
    current.unit_price > 0
      ? Math.round((savingPerUnit / current.unit_price) * 1000) / 10
      : 0;

  return {
    unitsNeeded,
    targetQuantity: next.min_quantity,
    currentUnitPrice: current.unit_price,
    nextUnitPrice: next.unit_price,
    savingPerUnit,
    savingPercent,
  };
}

/** Prices a single cart line, including its nudge. */
export function calculateLine(
  item: CartItem,
  threshold: number = TIER_NUDGE_THRESHOLD,
): CartLine {
  const quantity = normalizeRequestedQuantity(item.quantity);
  const activeTier = resolveTier(item.tiers, quantity);
  const unitPrice = activeTier?.unit_price ?? 0;

  return {
    item,
    unitPrice,
    lineTotal: roundMoney(unitPrice * quantity),
    activeTier,
    nudge: getNextTierNudge(item.tiers, quantity, threshold),
  };
}

/**
 * Prices the whole cart.
 *
 * VAT is computed once on the rounded net subtotal rather than per line: that
 * is what a Polish invoice does, and it avoids the cent-drift you get from
 * summing per-line VAT.
 */
export function calculateCartTotal(
  items: readonly CartItem[],
  vatRate: number = VAT_RATE,
): CartCalculation {
  const lines = items.map((item) => calculateLine(item));

  const subtotalNet = roundMoney(
    lines.reduce((sum, line) => sum + line.lineTotal, 0),
  );
  const vatAmount = roundMoney(subtotalNet * vatRate);

  return {
    lines,
    subtotalNet,
    vatRate,
    vatAmount,
    totalGross: roundMoney(subtotalNet + vatAmount),
    lineCount: lines.length,
    totalQuantity: lines.reduce(
      (sum, line) => sum + normalizeRequestedQuantity(line.item.quantity),
      0,
    ),
  };
}
