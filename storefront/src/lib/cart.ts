import type { CartItem, QuantityAdjustment } from '@/types/cart';
import type { Product, QuantityRules } from '@/types/product';

import { sortTiers } from './pricing';

/**
 * Cart operations as pure functions over an item array.
 *
 * The Zustand store (`@/stores/cart.store`) is a thin wrapper around these:
 * keeping the rules framework-free means the quantity logic — which is where
 * the category constraints actually bite — is testable without a DOM, a store
 * or localStorage.
 */

/** Quantity constraints come from the product's category. */
export function getQuantityRules(product: Product): QuantityRules {
  return {
    min: Math.max(1, product.category.min_quantity),
    step: Math.max(1, product.category.quantity_step),
  };
}

/**
 * Coerces a requested quantity to the nearest value the category allows.
 *
 * Valid quantities are `min`, `min + step`, `min + 2*step`, … Anything below
 * the minimum is raised to it; anything between two valid values snaps to the
 * nearer one, with ties resolved upward (a buyer who typed a number between
 * two pallets gets the larger pallet, not a silent downgrade).
 */
export function normalizeQuantity(
  requested: number,
  rules: QuantityRules,
): number {
  const min = Math.max(1, Math.floor(rules.min));
  const step = Math.max(1, Math.floor(rules.step));

  if (!Number.isFinite(requested)) return min;

  const value = Math.floor(requested);
  if (value <= min) return min;

  const stepsAbove = Math.round((value - min) / step);
  return min + stepsAbove * step;
}

/** Explains what `normalizeQuantity` did, for inline validation messages. */
export function adjustQuantity(
  requested: number,
  rules: QuantityRules,
): QuantityAdjustment {
  if (requested <= 0) return { kind: 'removed' };

  const normalized = normalizeQuantity(requested, rules);
  if (normalized === Math.floor(requested)) {
    return { kind: 'accepted', quantity: normalized };
  }
  if (requested < rules.min) {
    return { kind: 'raised_to_minimum', quantity: normalized, minimum: rules.min };
  }
  return { kind: 'snapped_to_step', quantity: normalized, step: rules.step };
}

/** The next valid quantity above `current` — the `+` button. */
export function incrementQuantity(current: number, rules: QuantityRules): number {
  return normalizeQuantity(current + Math.max(1, rules.step), rules);
}

/** The next valid quantity below `current`, floored at the minimum. */
export function decrementQuantity(current: number, rules: QuantityRules): number {
  return normalizeQuantity(current - Math.max(1, rules.step), rules);
}

/**
 * Builds a cart line from a catalogue product, snapshotting everything the
 * cart needs to price and render itself offline.
 */
export function cartItemFromProduct(
  product: Product,
  quantity?: number,
  now: Date = new Date(),
): CartItem {
  const rules = getQuantityRules(product);

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    imageUrl: product.image_url,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
    minQuantity: rules.min,
    quantityStep: rules.step,
    tiers: sortTiers(product.price_tiers),
    quantity: normalizeQuantity(quantity ?? rules.min, rules),
    addedAt: now.toISOString(),
  };
}

/** The rules carried on a cart line, for use after a reload. */
export function rulesFromCartItem(item: CartItem): QuantityRules {
  return {
    min: Math.max(1, item.minQuantity),
    step: Math.max(1, item.quantityStep),
  };
}

/**
 * Adds a product, or increases an existing line by `quantity`.
 *
 * Adding to an existing line sums the quantities before normalising, so
 * "add 5" twice reaches 10 rather than snapping back to the minimum.
 */
export function addItem(
  items: readonly CartItem[],
  item: CartItem,
  quantity?: number,
): CartItem[] {
  const rules = rulesFromCartItem(item);
  const amount = normalizeQuantity(quantity ?? item.quantity, rules);
  const existing = items.find((line) => line.productId === item.productId);

  if (!existing) {
    return [...items, { ...item, quantity: amount }];
  }

  return items.map((line) =>
    line.productId === item.productId
      ? {
          ...line,
          // Refresh the snapshot: prices and stock may have moved since the
          // line was first added.
          ...item,
          addedAt: line.addedAt,
          quantity: normalizeQuantity(line.quantity + amount, rules),
        }
      : line,
  );
}

/**
 * Sets an absolute quantity on a line. A quantity of zero or less removes the
 * line — the cart page confirms with the buyer before calling this.
 */
export function updateQuantity(
  items: readonly CartItem[],
  productId: string,
  quantity: number,
): CartItem[] {
  if (quantity <= 0) return removeItem(items, productId);

  return items.map((line) =>
    line.productId === productId
      ? { ...line, quantity: normalizeQuantity(quantity, rulesFromCartItem(line)) }
      : line,
  );
}

export function removeItem(
  items: readonly CartItem[],
  productId: string,
): CartItem[] {
  return items.filter((line) => line.productId !== productId);
}

export function findItem(
  items: readonly CartItem[],
  productId: string,
): CartItem | undefined {
  return items.find((line) => line.productId === productId);
}

/** Total units across all lines — the number on the header badge. */
export function countUnits(items: readonly CartItem[]): number {
  return items.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);
}
