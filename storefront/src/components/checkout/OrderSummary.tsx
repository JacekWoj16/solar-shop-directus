'use client';

import { BANK, PAYMENT_TERM_DAYS, SELLER, VAT_RATE } from '@/lib/constants';
import { formatNumber, formatPercent, formatPrice } from '@/lib/format';
import type { CartCalculation } from '@/types/cart';

/**
 * Read-only order summary shown beside the form.
 *
 * Repeats the line-by-line breakdown rather than just the total: this is the
 * last screen before a buyer commits to a five-figure transfer, and "what
 * exactly am I paying for" should not require going back.
 */
export function OrderSummary({ calculation }: { calculation: CartCalculation }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <h2 className="text-base font-semibold text-ink">Order summary</h2>

      <ul className="mt-4 space-y-3 border-t border-line pt-4">
        {calculation.lines.map(({ item, unitPrice, lineTotal }) => (
          <li key={item.productId} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="line-clamp-2 text-ink" title={item.name}>
                {item.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {formatNumber(item.quantity, 0)} × {formatPrice(unitPrice)}
              </p>
            </div>
            <span className="shrink-0 font-medium tabular-nums text-ink">
              {formatPrice(lineTotal)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Subtotal, net</dt>
          <dd className="font-medium tabular-nums text-ink">
            {formatPrice(calculation.subtotalNet)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">VAT {formatPercent(VAT_RATE)}</dt>
          <dd className="tabular-nums text-ink">{formatPrice(calculation.vatAmount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-ink">Total, gross</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {formatPrice(calculation.totalGross)}
          </dd>
        </div>
      </dl>

      {/* Informational, not a choice: there is exactly one payment method. */}
      <div className="mt-5 rounded-md border border-line bg-surface-sunken p-3 text-xs text-ink-muted">
        <p className="font-medium text-ink">Payment: bank transfer</p>
        <p className="mt-1 leading-relaxed">
          A proforma invoice is issued immediately with the order number as its
          payment reference, payable to {SELLER.name} within {PAYMENT_TERM_DAYS} days.
          Goods are dispatched once the transfer clears.
        </p>
        <p className="mt-2 font-mono text-[0.6875rem] text-ink">{BANK.iban}</p>
      </div>
    </div>
  );
}
