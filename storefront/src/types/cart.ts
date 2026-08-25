import type { PriceTier, TierNudge } from './product';

/**
 * Cart domain types.
 *
 * The cart is client-side only (Zustand + localStorage): there is no server
 * cart and no session. Each line therefore carries a *snapshot* of everything
 * needed to render and price itself, so a returning visitor sees a complete
 * cart before — or entirely without — a network round-trip. Prices are
 * re-validated server-side when the order is submitted.
 */
export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  imageUrl: string | null;
  /** Snapshot of the owning category, used for links and quantity rules. */
  categorySlug: string;
  categoryName: string;
  /** Copied from the category so the rules survive a page reload. */
  minQuantity: number;
  quantityStep: number;
  /** Copied from the product, sorted by `min_quantity` ascending. */
  tiers: PriceTier[];
  quantity: number;
  /** ISO timestamp of when the line was added; drives cart ordering. */
  addedAt: string;
}

/** A cart line with its tier-resolved pricing applied. */
export interface CartLine {
  item: CartItem;
  /** Net unit price for the line's current quantity. */
  unitPrice: number;
  /** `unitPrice * quantity`, rounded to grosze. */
  lineTotal: number;
  /** The tier that produced `unitPrice`; `null` when the product has none. */
  activeTier: PriceTier | null;
  /** Set when a slightly larger quantity would unlock a cheaper tier. */
  nudge: TierNudge | null;
}

/** Fully priced cart, recomputed on every quantity change. */
export interface CartCalculation {
  lines: CartLine[];
  /** Sum of line totals, net. */
  subtotalNet: number;
  /** VAT rate applied, as a fraction (0.23 for 23%). */
  vatRate: number;
  vatAmount: number;
  totalGross: number;
  /** Number of distinct products. */
  lineCount: number;
  /** Sum of all quantities, shown on the header badge. */
  totalQuantity: number;
}

/** Why a requested quantity change was rejected or adjusted. */
export type QuantityAdjustment =
  | { kind: 'accepted'; quantity: number }
  | { kind: 'raised_to_minimum'; quantity: number; minimum: number }
  | { kind: 'snapped_to_step'; quantity: number; step: number }
  | { kind: 'removed' };
