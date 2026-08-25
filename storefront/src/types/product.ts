/**
 * Catalogue domain types.
 *
 * These mirror the Directus collections (see docs/data-model.md) in their
 * *expanded* shape: every storefront query requests related records via
 * `fields`, so `Product.category` and `Product.price_tiers` are always
 * objects here, never bare foreign keys.
 */

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const STOCK_STATUSES: readonly StockStatus[] = [
  'in_stock',
  'low_stock',
  'out_of_stock',
] as const;

/**
 * One quantity bracket of a product's volume pricing.
 *
 * A tier is active when `min_quantity <= qty` and either `max_quantity` is
 * `null` (the open-ended top tier) or `qty <= max_quantity`.
 */
export interface PriceTier {
  id: string;
  /** First quantity covered by this tier, inclusive. */
  min_quantity: number;
  /** Last quantity covered, inclusive. `null` means unbounded. */
  max_quantity: number | null;
  /** Net unit price in PLN for quantities inside the bracket. */
  unit_price: number;
  sort_order: number;
}

/**
 * A product group. Order rules live here rather than on the product because
 * they are a commercial policy of the whole category — panels ship on pallets
 * of five, inverters do not.
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Smallest orderable quantity for any product in this category. */
  min_quantity: number;
  /** Quantity increment above the minimum. */
  quantity_step: number;
  sort_order: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string | null;
  /** Absolute URL on an external CDN; products are not uploaded to Directus. */
  image_url: string | null;
  /** Panel wattage. `null` for every non-panel category; drives power filters. */
  power_watts: number | null;
  stock_status: StockStatus;
  is_active: boolean;
  sort_order: number;
  date_created: string;
  date_updated: string | null;
  category: Category;
  /** Sorted by `min_quantity` ascending. May be empty — see `getUnitPrice`. */
  price_tiers: PriceTier[];
}

/**
 * The saving available if the buyer rounds their quantity up to the next
 * bracket. Rendered as the amber nudge in the cart and the product table.
 */
export interface TierNudge {
  /** How many more units are needed to reach `targetQuantity`. */
  unitsNeeded: number;
  /** The quantity at which the better tier starts. */
  targetQuantity: number;
  /** Net unit price currently being paid. */
  currentUnitPrice: number;
  /** Net unit price once the tier is reached. */
  nextUnitPrice: number;
  /** Per-unit saving in PLN. */
  savingPerUnit: number;
  /** Per-unit saving as a percentage, rounded to one decimal place. */
  savingPercent: number;
}

/** Quantity constraints resolved for a single product, ready for the input. */
export interface QuantityRules {
  min: number;
  step: number;
}

/** Sort options offered above the product table. */
export type ProductSort =
  | 'name_asc'
  | 'name_desc'
  | 'price_asc'
  | 'price_desc'
  | 'sku_asc';

/** Filter state for a category or search result page, mirrored in the URL. */
export interface ProductFilters {
  brands: string[];
  /** Inclusive wattage bounds, applied only to categories that expose power. */
  powerMin: number | null;
  powerMax: number | null;
  /** Bounds on the entry-tier net unit price, in PLN. */
  priceMin: number | null;
  priceMax: number | null;
  inStockOnly: boolean;
}
