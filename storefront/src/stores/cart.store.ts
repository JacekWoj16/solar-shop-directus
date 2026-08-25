'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  addItem,
  cartItemFromProduct,
  countUnits,
  decrementQuantity,
  findItem,
  incrementQuantity,
  removeItem,
  rulesFromCartItem,
  updateQuantity,
} from '@/lib/cart';
import { calculateCartTotal } from '@/lib/pricing';
import type { CartCalculation, CartItem } from '@/types/cart';
import type { Product } from '@/types/product';

/**
 * Client-side cart.
 *
 * All rules live in `@/lib/cart` and `@/lib/pricing`; this store only owns
 * persistence and React bindings. Quantities are re-normalised on every write
 * rather than trusted from storage, so a cart saved before a category's
 * minimum changed is corrected the moment it is touched.
 */

const STORAGE_KEY = 'solar-shop-cart';

/** Bumped whenever the persisted shape changes; see `migrate` below. */
const STORAGE_VERSION = 1;

interface CartState {
  items: CartItem[];
  /**
   * False until localStorage has been read. Components render the empty cart
   * on the server and during the first client pass, then swap in the real one
   * — reading persisted state during render would desynchronise the markup.
   */
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

/** Stand-in storage for the server pass, where `localStorage` does not exist. */
const noopStorage: Storage = {
  length: 0,
  clear: () => undefined,
  getItem: () => null,
  key: () => null,
  removeItem: () => undefined,
  setItem: () => undefined,
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      add: (product, quantity) =>
        set({
          items: addItem(
            get().items,
            cartItemFromProduct(product, quantity),
            quantity,
          ),
        }),

      setQuantity: (productId, quantity) =>
        set({ items: updateQuantity(get().items, productId, quantity) }),

      increment: (productId) => {
        const item = findItem(get().items, productId);
        if (!item) return;
        set({
          items: updateQuantity(
            get().items,
            productId,
            incrementQuantity(item.quantity, rulesFromCartItem(item)),
          ),
        });
      },

      decrement: (productId) => {
        const item = findItem(get().items, productId);
        if (!item) return;
        set({
          items: updateQuantity(
            get().items,
            productId,
            decrementQuantity(item.quantity, rulesFromCartItem(item)),
          ),
        });
      },

      remove: (productId) => set({ items: removeItem(get().items, productId) }),

      clear: () => set({ items: [] }),
    }),
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage(() =>
        typeof window === 'undefined' ? noopStorage : window.localStorage,
      ),
      // `hasHydrated` is derived, never persisted.
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, version) => {
        // No breaking changes yet; the hook exists so that a future field can
        // be added without discarding live carts.
        if (version < STORAGE_VERSION) return persisted as { items: CartItem[] };
        return persisted as { items: CartItem[] };
      },
      onRehydrateStorage: () => (state) => {
        // Runs after storage is read, including when nothing was stored.
        state?.setHasHydrated(true);
      },
    },
  ),
);

/* -------------------------------------------------------------------------
 * Selectors
 * ---------------------------------------------------------------------- */

/** Total units in the cart — the header badge. Zero until hydrated. */
export function useCartUnitCount(): number {
  return useCartStore((state) =>
    state.hasHydrated ? countUnits(state.items) : 0,
  );
}

/** Number of distinct products in the cart. */
export function useCartLineCount(): number {
  return useCartStore((state) => (state.hasHydrated ? state.items.length : 0));
}

/**
 * The fully priced cart. Recomputed on every quantity change, which is cheap:
 * even a large B2B order is a few dozen lines.
 */
export function useCartCalculation(): CartCalculation {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  return calculateCartTotal(hasHydrated ? items : []);
}

/** The cart line for one product, if present. */
export function useCartItem(productId: string): CartItem | undefined {
  return useCartStore((state) => findItem(state.items, productId));
}
