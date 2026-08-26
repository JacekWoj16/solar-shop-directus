'use client';

import { useState } from 'react';

import { formatNumber } from '@/lib/format';
import { useCartCalculation, useCartStore } from '@/stores/cart.store';
import type { Category } from '@/types/product';

import { CartSummary } from './CartSummary';
import { CartTable } from './CartTable';
import { EmptyCart } from './EmptyCart';

/**
 * The cart's client half.
 *
 * The cart lives in `localStorage`, which the server cannot see, so the first
 * render on the client must match the server's — an empty cart — and only then
 * swap in the stored one. Rendering persisted state during that first pass is
 * the classic hydration mismatch. A skeleton covers the gap, which is a frame
 * or two, rather than flashing "your cart is empty" at someone whose cart is
 * not empty.
 */
export function CartContents({ categories }: { categories: Category[] }) {
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const clear = useCartStore((state) => state.clear);
  const calculation = useCartCalculation();

  const [confirmingClear, setConfirmingClear] = useState(false);

  if (!hasHydrated) return <CartSkeleton />;

  if (calculation.lines.length === 0) {
    return <EmptyCart categories={categories} />;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <CartTable lines={calculation.lines} />

        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-ink-muted">
            Prices recalculate as quantities change. All figures net of VAT.
          </p>

          {confirmingClear ? (
            <span className="inline-flex shrink-0 items-center gap-2 text-xs">
              <span className="text-ink-muted">
                Remove all {formatNumber(calculation.lineCount, 0)} products?
              </span>
              <button
                type="button"
                onClick={() => {
                  clear();
                  setConfirmingClear(false);
                }}
                className="font-semibold text-stock-out underline-offset-2 hover:underline"
              >
                Clear cart
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-ink-muted underline-offset-2 hover:underline"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="shrink-0 text-xs text-ink-muted underline-offset-2 hover:text-stock-out hover:underline"
            >
              Clear cart
            </button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <CartSummary calculation={calculation} />
      </aside>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-md bg-surface-sunken" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-surface-sunken" />
    </div>
  );
}
