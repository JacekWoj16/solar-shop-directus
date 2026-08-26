'use client';

import Link from 'next/link';

import { useCartUnitCount } from '@/stores/cart.store';
import { formatNumber } from '@/lib/format';

/**
 * Cart link with a unit badge.
 *
 * The count reads zero until the store reports hydration, so the server markup
 * and the first client render agree. Showing a persisted count during that pass
 * would be a hydration mismatch.
 */
export function CartIcon() {
  const units = useCartUnitCount();

  return (
    <Link
      href="/cart"
      className="relative flex shrink-0 items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="size-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c.51 0 .96-.343 1.087-.835l1.383-5.182A1.125 1.125 0 0 0 20.148 6.75H5.106m2.394 7.5L5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>

      <span className="hidden sm:inline">Cart</span>

      {units > 0 ? (
        <span
          className="min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-xs font-semibold leading-none text-white"
          aria-label={`${units} units in cart`}
        >
          {formatNumber(units, 0)}
        </span>
      ) : null}
    </Link>
  );
}
