import { describe, expect, it } from 'vitest';

import {
  addItem,
  adjustQuantity,
  cartItemFromProduct,
  countUnits,
  decrementQuantity,
  findItem,
  getQuantityRules,
  incrementQuantity,
  normalizeQuantity,
  removeItem,
  updateQuantity,
} from '@/lib/cart';

import { cartItem, category, product, tier } from './fixtures';

/** Solar panels: minimum five, then one at a time. */
const panelRules = { min: 5, step: 1 };
/** A cable sold on 10-metre rolls: whole rolls only. */
const rollRules = { min: 1, step: 10 };

describe('getQuantityRules', () => {
  it('takes the rules from the product category', () => {
    const panels = product({
      category: category({ min_quantity: 5, quantity_step: 1 }),
    });
    expect(getQuantityRules(panels)).toEqual({ min: 5, step: 1 });
  });

  it('never allows a zero minimum or step from bad CMS data', () => {
    const broken = product({
      category: category({ min_quantity: 0, quantity_step: 0 }),
    });
    expect(getQuantityRules(broken)).toEqual({ min: 1, step: 1 });
  });
});

describe('normalizeQuantity', () => {
  it('raises anything below the minimum up to it', () => {
    expect(normalizeQuantity(1, panelRules)).toBe(5);
    expect(normalizeQuantity(0, panelRules)).toBe(5);
    expect(normalizeQuantity(-10, panelRules)).toBe(5);
  });

  it('leaves a valid quantity untouched', () => {
    expect(normalizeQuantity(5, panelRules)).toBe(5);
    expect(normalizeQuantity(37, panelRules)).toBe(37);
  });

  it('snaps to the category step, rounding ties upward', () => {
    expect(normalizeQuantity(11, rollRules)).toBe(11);
    expect(normalizeQuantity(14, rollRules)).toBe(11);
    expect(normalizeQuantity(16, rollRules)).toBe(21);
    expect(normalizeQuantity(6, rollRules)).toBe(11);
  });

  it('truncates fractional input and survives NaN', () => {
    expect(normalizeQuantity(7.9, panelRules)).toBe(7);
    expect(normalizeQuantity(Number.NaN, panelRules)).toBe(5);
    expect(normalizeQuantity(Number.POSITIVE_INFINITY, panelRules)).toBe(5);
  });
});

describe('adjustQuantity', () => {
  it('reports an accepted value', () => {
    expect(adjustQuantity(10, panelRules)).toEqual({
      kind: 'accepted',
      quantity: 10,
    });
  });

  it('reports a value raised to the category minimum', () => {
    expect(adjustQuantity(2, panelRules)).toEqual({
      kind: 'raised_to_minimum',
      quantity: 5,
      minimum: 5,
    });
  });

  it('reports a value snapped to the step', () => {
    expect(adjustQuantity(16, rollRules)).toEqual({
      kind: 'snapped_to_step',
      quantity: 21,
      step: 10,
    });
  });

  it('treats zero as a removal', () => {
    expect(adjustQuantity(0, panelRules)).toEqual({ kind: 'removed' });
    expect(adjustQuantity(-3, panelRules)).toEqual({ kind: 'removed' });
  });
});

describe('increment / decrement', () => {
  it('moves by one step', () => {
    expect(incrementQuantity(5, panelRules)).toBe(6);
    expect(decrementQuantity(6, panelRules)).toBe(5);
    expect(incrementQuantity(1, rollRules)).toBe(11);
    expect(decrementQuantity(11, rollRules)).toBe(1);
  });

  it('never drops below the minimum', () => {
    expect(decrementQuantity(5, panelRules)).toBe(5);
    expect(decrementQuantity(1, rollRules)).toBe(1);
  });
});

describe('cartItemFromProduct', () => {
  it('snapshots the product, its category rules and its sorted tiers', () => {
    const panels = product({
      category: category({ min_quantity: 5, quantity_step: 1 }),
      price_tiers: [tier(100, null, 810), tier(1, 99, 890)],
    });

    const item = cartItemFromProduct(panels, undefined, new Date('2026-08-25T10:00:00Z'));

    expect(item.productId).toBe(panels.id);
    expect(item.sku).toBe(panels.sku);
    expect(item.categorySlug).toBe('solar-panels');
    expect(item.minQuantity).toBe(5);
    expect(item.quantityStep).toBe(1);
    expect(item.tiers.map((t) => t.min_quantity)).toEqual([1, 100]);
    expect(item.addedAt).toBe('2026-08-25T10:00:00.000Z');
  });

  it('defaults the quantity to the category minimum', () => {
    const panels = product({ category: category({ min_quantity: 5 }) });
    expect(cartItemFromProduct(panels).quantity).toBe(5);
  });

  it('normalises an explicit quantity against the category rules', () => {
    const panels = product({ category: category({ min_quantity: 5 }) });
    expect(cartItemFromProduct(panels, 2).quantity).toBe(5);
  });
});

describe('addItem', () => {
  it('appends a new line', () => {
    const items = addItem([], cartItem({ productId: 'a', quantity: 3 }));

    expect(items).toHaveLength(1);
    expect(items[0]!.productId).toBe('a');
    expect(items[0]!.quantity).toBe(3);
  });

  it('sums quantities when the product is already in the cart', () => {
    const first = addItem([], cartItem({ productId: 'a', quantity: 5 }));
    const second = addItem(first, cartItem({ productId: 'a', quantity: 5 }), 5);

    expect(second).toHaveLength(1);
    expect(second[0]!.quantity).toBe(10);
  });

  it('keeps the original addedAt but refreshes the product snapshot', () => {
    const existing = [
      cartItem({ productId: 'a', quantity: 5, addedAt: '2026-01-01T00:00:00Z' }),
    ];
    const updated = addItem(
      existing,
      cartItem({
        productId: 'a',
        quantity: 5,
        name: 'Renamed panel',
        addedAt: '2026-08-25T00:00:00Z',
      }),
    );

    expect(updated[0]!.addedAt).toBe('2026-01-01T00:00:00Z');
    expect(updated[0]!.name).toBe('Renamed panel');
  });

  it('does not mutate the input array', () => {
    const items = [cartItem({ productId: 'a' })];
    addItem(items, cartItem({ productId: 'b' }));
    expect(items).toHaveLength(1);
  });
});

describe('updateQuantity', () => {
  it('sets an absolute quantity, normalised to the line rules', () => {
    const items = [cartItem({ productId: 'a', minQuantity: 5, quantity: 10 })];
    expect(updateQuantity(items, 'a', 2)[0]!.quantity).toBe(5);
    expect(updateQuantity(items, 'a', 40)[0]!.quantity).toBe(40);
  });

  it('removes the line when the quantity reaches zero', () => {
    const items = [cartItem({ productId: 'a' }), cartItem({ productId: 'b' })];
    const result = updateQuantity(items, 'a', 0);

    expect(result).toHaveLength(1);
    expect(result[0]!.productId).toBe('b');
  });

  it('ignores an unknown product id', () => {
    const items = [cartItem({ productId: 'a', quantity: 5 })];
    expect(updateQuantity(items, 'missing', 99)).toEqual(items);
  });

  it('applies each line its own rules in a mixed-category cart', () => {
    const items = [
      cartItem({ productId: 'panel', minQuantity: 5, quantityStep: 1, quantity: 5 }),
      cartItem({ productId: 'cable', minQuantity: 1, quantityStep: 10, quantity: 1 }),
    ];

    const afterPanel = updateQuantity(items, 'panel', 2);
    expect(afterPanel[0]!.quantity).toBe(5);
    expect(afterPanel[1]!.quantity).toBe(1);

    const afterCable = updateQuantity(items, 'cable', 16);
    expect(afterCable[1]!.quantity).toBe(21);
  });
});

describe('removeItem / findItem / countUnits', () => {
  it('removes only the requested line', () => {
    const items = [cartItem({ productId: 'a' }), cartItem({ productId: 'b' })];
    expect(removeItem(items, 'a').map((i) => i.productId)).toEqual(['b']);
    expect(removeItem(items, 'missing')).toHaveLength(2);
  });

  it('finds a line by product id', () => {
    const items = [cartItem({ productId: 'a' })];
    expect(findItem(items, 'a')?.productId).toBe('a');
    expect(findItem(items, 'b')).toBeUndefined();
  });

  it('counts total units across lines', () => {
    expect(
      countUnits([
        cartItem({ productId: 'a', quantity: 10 }),
        cartItem({ productId: 'b', quantity: 3 }),
      ]),
    ).toBe(13);
    expect(countUnits([])).toBe(0);
  });
});
