import type { CartItem } from '@/types/cart';
import type { Category, PriceTier, Product } from '@/types/product';

/** Test data builders. Every field has a sane default; override what matters. */

let tierCounter = 0;

export function tier(
  min_quantity: number,
  max_quantity: number | null,
  unit_price: number,
  sort_order = tierCounter++,
): PriceTier {
  return {
    id: `tier-${min_quantity}-${max_quantity ?? 'inf'}`,
    min_quantity,
    max_quantity,
    unit_price,
    sort_order,
  };
}

/** The four-bracket structure used for solar panels in the seed data. */
export const panelTiers: PriceTier[] = [
  tier(1, 4, 890),
  tier(5, 99, 845),
  tier(100, 499, 810),
  tier(500, null, 775),
];

export function category(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-panels',
    name: 'Solar Panels',
    slug: 'solar-panels',
    description: null,
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 1,
    is_active: true,
    ...overrides,
  };
}

export function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sku: 'PNL-MONO-455',
    name: 'Mono 455W N-Type bifacial',
    brand: 'Jinko',
    description: null,
    image_url: null,
    power_watts: 455,
    stock_status: 'in_stock',
    is_active: true,
    sort_order: 1,
    date_created: '2026-01-01T00:00:00Z',
    date_updated: null,
    category: category(),
    price_tiers: panelTiers,
    ...overrides,
  };
}

export function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'prod-1',
    sku: 'PNL-MONO-455',
    name: 'Mono 455W N-Type bifacial',
    brand: 'Jinko',
    imageUrl: null,
    categorySlug: 'solar-panels',
    categoryName: 'Solar Panels',
    minQuantity: 1,
    quantityStep: 1,
    tiers: panelTiers,
    quantity: 1,
    addedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}
