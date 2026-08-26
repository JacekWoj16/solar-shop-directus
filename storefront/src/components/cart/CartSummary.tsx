'use client';

import Link from 'next/link';

import { PAYMENT_TERM_DAYS, VAT_RATE } from '@/lib/constants';
import { formatNumber, formatPercent, formatPrice } from '@/lib/format';
import type { CartCalculation } from '@/types/cart';

/**
 * Order totals.
 *
 * Net first and gross last, in that order, because these are trade prices: the
 * buyer works in net and their accountant needs the gross. VAT is computed once
 * on the rounded net subtotal, which is what a Polish invoice does — summing
 * per-line VAT accumulates a grosz of drift across a large order.
 */
export function CartSummary({ calculation }: { calculation: CartCalculation }) {
  const { subtotalNet, vatAmount, totalGross, lineCount, totalQuantity } = calculation;

  const availableSavings = calculation.lines.reduce(
    (sum, line) => sum + (line.nudge ? line.nudge.savingPerUnit * line.item.quantity : 0),
    0,
  );

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">Order summary</h2>

      <p className="mt-1 text-xs text-ink-muted">
        {formatNumber(lineCount, 0)} {lineCount === 1 ? 'product' : 'products'} ·{' '}
        {formatNumber(totalQuantity, 0)} units
      </p>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Subtotal, net</dt>
          <dd className="font-medium tabular-nums text-ink">{formatPrice(subtotalNet)}</dd>
        </div>

        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">VAT {formatPercent(VAT_RATE)}</dt>
          <dd className="tabular-nums text-ink">{formatPrice(vatAmount)}</dd>
        </div>

        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink">Total, gross</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {formatPrice(totalGross)}
          </dd>
        </div>
      </dl>

      {availableSavings > 0 ? (
        <p className="mt-4 rounded-md bg-nudge-surface px-3 py-2 text-xs text-ink">
          Rounding your quantities up to the next brackets would save{' '}
          <span className="font-semibold">{formatPrice(availableSavings)}</span> net.
        </p>
      ) : null}

      <Link
        href="/checkout"
        className="mt-5 block rounded-md bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Proceed to checkout
      </Link>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        Payment by bank transfer against a proforma invoice, due within{' '}
        {PAYMENT_TERM_DAYS} days. Shipping is quoted separately on the proforma.
      </p>
    </div>
  );
}
