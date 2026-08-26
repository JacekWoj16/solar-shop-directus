import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { BANK, PAYMENT_TERM_DAYS, SELLER, VAT_RATE } from '@/lib/constants';
import {
  formatDate,
  formatNumber,
  formatPercent,
  formatPrice,
} from '@/lib/format';
import { formatNip } from '@/lib/nip';
import { getOrderById } from '@/lib/orders';
import type { OrderStatus } from '@/types/order';

/**
 * Order confirmation.
 *
 * A blocking route: `instant = false` is what lets it read uncached data without
 * a Suspense boundary, which `cacheComponents` otherwise refuses to prerender.
 *
 * **Known limitation.** An unknown order id renders the 404 page but answers
 * with `200`. The root layout is prerendered, so the response has already begun
 * by the time either `generateMetadata` or the component can call `notFound()`,
 * and the status is fixed. Moving the check earlier does not help — this is
 * inherent to serving a static shell. Fixing it properly would mean giving up
 * partial prerendering across the whole storefront, or checking the order in
 * middleware and paying a database round-trip on every request to this path.
 * Neither is worth it for a `noindex` page reached from an emailed link, where
 * the visitor sees a correct "not found" either way — but it is a real defect,
 * not a design choice, and it is recorded as one.
 *
 * `cache()` is React's per-request memoisation, not a data cache: it stops the
 * metadata pass and the render pass from each fetching the order, without the
 * result ever outliving the request. This is one buyer's order, so it must never
 * come from a shared cache — `getOrderById` deliberately does not opt in.
 */
export const instant = false;

/** Deduplicated within a single request; never cached across requests. */
const loadOrder = cache(getOrderById);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderId: string }>;
}): Promise<Metadata> {
  const { orderId } = await params;
  const order = await loadOrder(orderId);

  if (!order) notFound();

  return {
    title: `Order ${order.order_number}`,
    robots: { index: false, follow: false },
  };
}
const STATUS_LABELS: Record<OrderStatus, { label: string; className: string }> = {
  pending_payment: {
    label: 'Awaiting payment',
    className: 'bg-nudge-surface text-stock-low',
  },
  payment_confirmed: {
    label: 'Payment confirmed',
    className: 'bg-brand-soft text-brand',
  },
  shipped: { label: 'Shipped', className: 'bg-brand-soft text-brand' },
  completed: { label: 'Completed', className: 'bg-stock-in/10 text-stock-in' },
  cancelled: { label: 'Cancelled', className: 'bg-stock-out/10 text-stock-out' },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await loadOrder(orderId);

  if (!order) notFound();

  const status = STATUS_LABELS[order.status];
  const issued = order.date_created ? new Date(order.date_created) : new Date();
  const due = new Date(issued);
  due.setDate(due.getDate() + PAYMENT_TERM_DAYS);

  return (
    <div className="shell max-w-4xl py-10">
      <div className="rounded-lg border border-stock-in/30 bg-stock-in/5 p-5">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          Order {order.order_number} received
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          A proforma invoice has been issued. Nothing has been charged — transfer
          the amount below to complete the order.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
        <span className="text-ink-muted">
          Placed {formatDate(issued)}
        </span>
        <span className="text-ink-muted">
          {order.invoice_type === 'nip' ? 'Company invoice' : 'Anonymous invoice'}
        </span>
      </div>

      {/* Payment instructions come before the line items: this is the one thing
          the buyer has to act on, and burying it under a table would be
          perverse. */}
      <section className="mt-8 rounded-lg border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">How to pay</h2>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-muted">Amount</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">
              {formatPrice(order.total_gross)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-muted">
              Payment reference
            </dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-ink">
              {order.order_number}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-ink-muted">
              Account number
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-ink">{BANK.iban}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-muted">Payee</dt>
            <dd className="mt-0.5 text-ink">{BANK.accountName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-muted">Due by</dt>
            <dd className="mt-0.5 text-ink">{formatDate(due)}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-ink-muted">
          Please use the order number as the transfer title — it is what incoming
          payments are matched against. Goods are dispatched once the transfer
          clears.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-ink">Items</h2>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong bg-table-head text-xs uppercase tracking-wider text-ink-muted">
                <th scope="col" className="py-2 pr-4 font-medium">Product</th>
                <th scope="col" className="py-2 pr-4 font-medium">SKU</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">Unit, net</th>
                <th scope="col" className="py-2 text-right font-medium">Line, net</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2.5 pr-4 text-ink">{item.product_name}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-ink-subtle">
                    {item.product_sku}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink">
                    {formatNumber(item.quantity, 0)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-ink">
                    {formatPrice(item.unit_price)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums text-ink">
                    {formatPrice(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-4 max-w-xs space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Subtotal, net</dt>
            <dd className="tabular-nums text-ink">{formatPrice(order.subtotal_net)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">VAT {formatPercent(VAT_RATE)}</dt>
            <dd className="tabular-nums text-ink">{formatPrice(order.vat_amount)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt className="font-semibold text-ink">Total, gross</dt>
            <dd className="font-semibold tabular-nums text-ink">
              {formatPrice(order.total_gross)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Delivery
          </h2>
          <address className="mt-2 text-sm not-italic leading-relaxed text-ink">
            {order.delivery_name}
            <br />
            {order.delivery_address}
            <br />
            {order.delivery_postal_code} {order.delivery_city}
            <br />
            <span className="text-ink-muted">{order.delivery_phone}</span>
            <br />
            <span className="text-ink-muted">{order.delivery_email}</span>
          </address>
          {order.notes ? (
            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-medium text-ink">Notes:</span> {order.notes}
            </p>
          ) : null}
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Invoice
          </h2>
          {order.invoice_type === 'nip' ? (
            <address className="mt-2 whitespace-pre-line text-sm not-italic leading-relaxed text-ink">
              {order.company_name}
              {'\n'}
              {order.company_address}
              {'\n'}
              NIP {formatNip(order.nip ?? '')}
            </address>
          ) : (
            <p className="mt-2 text-sm text-ink">
              Anonymous invoice — faktura bezimienna. No buyer details are printed
              on the document.
            </p>
          )}

          <p className="mt-4 text-xs text-ink-muted">
            Issued by {SELLER.name}, NIP {formatNip(SELLER.nip)}.
          </p>
        </div>
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <Link
          href="/"
          className="text-sm font-medium text-brand underline-offset-2 hover:underline"
        >
          ← Continue browsing
        </Link>
      </div>
    </div>
  );
}
