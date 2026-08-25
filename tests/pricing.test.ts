import { describe, expect, it } from 'vitest';

import {
  calculateCartTotal,
  calculateLine,
  getBestPrice,
  getEntryPrice,
  getNextTierNudge,
  getUnitPrice,
  resolveTier,
  sortTiers,
} from '@/lib/pricing';

import { cartItem, panelTiers, tier } from './fixtures';

describe('sortTiers', () => {
  it('orders by min_quantity without mutating the input', () => {
    const unsorted = [tier(100, 499, 810), tier(1, 4, 890), tier(5, 99, 845)];
    const snapshot = [...unsorted];

    expect(sortTiers(unsorted).map((t) => t.min_quantity)).toEqual([1, 5, 100]);
    expect(unsorted).toEqual(snapshot);
  });
});

describe('getUnitPrice', () => {
  it('picks the bracket containing the quantity', () => {
    expect(getUnitPrice(panelTiers, 3)).toBe(890);
    expect(getUnitPrice(panelTiers, 50)).toBe(845);
    expect(getUnitPrice(panelTiers, 250)).toBe(810);
    expect(getUnitPrice(panelTiers, 1000)).toBe(775);
  });

  it('is inclusive at both ends of a bracket', () => {
    expect(getUnitPrice(panelTiers, 4)).toBe(890);
    expect(getUnitPrice(panelTiers, 5)).toBe(845);
    expect(getUnitPrice(panelTiers, 99)).toBe(845);
    expect(getUnitPrice(panelTiers, 100)).toBe(810);
    expect(getUnitPrice(panelTiers, 499)).toBe(810);
    expect(getUnitPrice(panelTiers, 500)).toBe(775);
  });

  it('resolves correctly when tiers arrive out of order', () => {
    const shuffled = [panelTiers[3]!, panelTiers[0]!, panelTiers[2]!, panelTiers[1]!];
    expect(getUnitPrice(shuffled, 50)).toBe(845);
  });

  it('returns null for a product with no tiers so the UI can ask for a quote', () => {
    expect(getUnitPrice([], 10)).toBeNull();
    expect(resolveTier([], 10)).toBeNull();
  });

  it('handles a single-tier product at any quantity', () => {
    const flat = [tier(1, null, 120)];
    expect(getUnitPrice(flat, 1)).toBe(120);
    expect(getUnitPrice(flat, 9999)).toBe(120);
  });

  it('falls back to the entry bracket below the lowest min_quantity', () => {
    const startsAtFive = [tier(5, 99, 845), tier(100, null, 810)];
    expect(getUnitPrice(startsAtFive, 2)).toBe(845);
  });

  it('keeps the last earned bracket above a bounded top tier', () => {
    const bounded = [tier(1, 10, 500)];
    expect(getUnitPrice(bounded, 50)).toBe(500);
  });

  it('uses the last cleared bracket inside a gap between tiers', () => {
    const gapped = [tier(1, 4, 900), tier(10, null, 800)];
    expect(getUnitPrice(gapped, 7)).toBe(900);
  });

  it('treats zero, negative and fractional quantities as at least one unit', () => {
    expect(getUnitPrice(panelTiers, 0)).toBe(890);
    expect(getUnitPrice(panelTiers, -5)).toBe(890);
    expect(getUnitPrice(panelTiers, 5.9)).toBe(845);
    expect(getUnitPrice(panelTiers, Number.NaN)).toBe(890);
  });
});

describe('getEntryPrice / getBestPrice', () => {
  it('reports the list price and the floor price', () => {
    expect(getEntryPrice(panelTiers)).toBe(890);
    expect(getBestPrice(panelTiers)).toBe(775);
  });

  it('returns null without tiers', () => {
    expect(getEntryPrice([])).toBeNull();
    expect(getBestPrice([])).toBeNull();
  });
});

describe('getNextTierNudge', () => {
  it('prompts when the next bracket is within the threshold', () => {
    const nudge = getNextTierNudge(panelTiers, 3);

    expect(nudge).not.toBeNull();
    expect(nudge!.unitsNeeded).toBe(2);
    expect(nudge!.targetQuantity).toBe(5);
    expect(nudge!.currentUnitPrice).toBe(890);
    expect(nudge!.nextUnitPrice).toBe(845);
    expect(nudge!.savingPerUnit).toBe(45);
    expect(nudge!.savingPercent).toBeCloseTo(5.1, 1);
  });

  it('stays silent when the next bracket is further away than the threshold', () => {
    expect(getNextTierNudge(panelTiers, 50)).toBeNull();
  });

  it('respects a custom threshold', () => {
    expect(getNextTierNudge(panelTiers, 90)).toBeNull();
    expect(getNextTierNudge(panelTiers, 90, 10)).not.toBeNull();
    expect(getNextTierNudge(panelTiers, 90, 10)!.unitsNeeded).toBe(10);
  });

  it('stays silent on the best tier', () => {
    expect(getNextTierNudge(panelTiers, 500)).toBeNull();
    expect(getNextTierNudge(panelTiers, 9999)).toBeNull();
  });

  it('stays silent exactly at a bracket boundary', () => {
    expect(getNextTierNudge(panelTiers, 5)).toBeNull();
    expect(getNextTierNudge(panelTiers, 100)).toBeNull();
  });

  it('never advertises a more expensive bracket', () => {
    const badData = [tier(1, 9, 100), tier(10, null, 120)];
    expect(getNextTierNudge(badData, 8)).toBeNull();
  });

  it('needs at least two tiers', () => {
    expect(getNextTierNudge([tier(1, null, 100)], 1)).toBeNull();
    expect(getNextTierNudge([], 1)).toBeNull();
  });

  it('skips a bracket that is near but not cheaper, to a later one that is', () => {
    const tiers = [tier(1, 4, 100), tier(5, 9, 100), tier(10, null, 80)];
    expect(getNextTierNudge(tiers, 3)).toBeNull();
    expect(getNextTierNudge(tiers, 8)!.targetQuantity).toBe(10);
  });
});

describe('calculateLine', () => {
  it('prices a line at its tier and rounds to grosze', () => {
    const line = calculateLine(cartItem({ quantity: 10 }));

    expect(line.unitPrice).toBe(845);
    expect(line.lineTotal).toBe(8450);
    expect(line.activeTier!.min_quantity).toBe(5);
  });

  it('prices an untiered product at zero and flags no tier', () => {
    const line = calculateLine(cartItem({ tiers: [], quantity: 3 }));

    expect(line.activeTier).toBeNull();
    expect(line.unitPrice).toBe(0);
    expect(line.lineTotal).toBe(0);
  });

  it('avoids binary floating-point drift in line totals', () => {
    const line = calculateLine(
      cartItem({ tiers: [tier(1, null, 274.54)], quantity: 3 }),
    );
    expect(line.lineTotal).toBe(823.62);
  });
});

describe('calculateCartTotal', () => {
  it('sums lines, applies 23% VAT and reports counts', () => {
    const result = calculateCartTotal([
      cartItem({ productId: 'a', quantity: 10 }), // 10 x 845 = 8450
      cartItem({
        productId: 'b',
        tiers: [tier(1, null, 100)],
        quantity: 2,
      }), // 2 x 100 = 200
    ]);

    expect(result.subtotalNet).toBe(8650);
    expect(result.vatAmount).toBe(1989.5);
    expect(result.totalGross).toBe(10639.5);
    expect(result.lineCount).toBe(2);
    expect(result.totalQuantity).toBe(12);
  });

  it('applies each line its own category tiers in a mixed cart', () => {
    const result = calculateCartTotal([
      cartItem({ productId: 'panel', quantity: 100 }), // 810
      cartItem({ productId: 'panel-2', quantity: 4 }), // 890
    ]);

    expect(result.lines[0]!.unitPrice).toBe(810);
    expect(result.lines[1]!.unitPrice).toBe(890);
    expect(result.subtotalNet).toBe(100 * 810 + 4 * 890);
  });

  it('computes VAT once on the rounded net subtotal, not per line', () => {
    const result = calculateCartTotal([
      cartItem({ productId: 'a', tiers: [tier(1, null, 0.01)], quantity: 1 }),
      cartItem({ productId: 'b', tiers: [tier(1, null, 0.01)], quantity: 1 }),
    ]);

    expect(result.subtotalNet).toBe(0.02);
    expect(result.vatAmount).toBe(0);
    expect(result.totalGross).toBe(0.02);
  });

  it('returns a zeroed calculation for an empty cart', () => {
    const result = calculateCartTotal([]);

    expect(result.subtotalNet).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.totalGross).toBe(0);
    expect(result.lineCount).toBe(0);
    expect(result.totalQuantity).toBe(0);
  });

  it('honours a non-default VAT rate', () => {
    const result = calculateCartTotal(
      [cartItem({ tiers: [tier(1, null, 100)], quantity: 1 })],
      0.08,
    );

    expect(result.vatAmount).toBe(8);
    expect(result.totalGross).toBe(108);
  });
});
