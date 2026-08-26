'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  EMPTY_CHECKOUT,
  validateCheckout,
  type CheckoutErrors,
  type CheckoutInput,
} from '@/lib/checkout';
import { useCartCalculation, useCartStore } from '@/stores/cart.store';
import type { Category } from '@/types/product';

import { CompanyDetailsForm } from './CompanyDetailsForm';
import { DeliveryAddressForm } from './DeliveryAddressForm';
import { InvoiceTypeSelector } from './InvoiceTypeSelector';
import { OrderSummary } from './OrderSummary';

/**
 * Checkout.
 *
 * Laid out as one page of numbered sections rather than a multi-screen wizard.
 * A wizard hides the total behind two clicks and makes correcting a typo in
 * step 1 a journey; a trade buyer placing a repeat order wants the whole form
 * and the whole total in front of them.
 *
 * Validation runs on submit, not per keystroke — a form that turns red while
 * you are still typing your email is arguing with you — and the same
 * `validateCheckout` runs again on the server, which is the copy that counts.
 */
export function CheckoutForm({ categories }: { categories: Category[] }) {
  const router = useRouter();

  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const clear = useCartStore((state) => state.clear);
  const calculation = useCartCalculation();

  const [values, setValues] = useState<CheckoutInput>(EMPTY_CHECKOUT);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);

  function update<K extends keyof CheckoutInput>(field: K, value: CheckoutInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    // Clear a field's error as soon as it is touched: leaving it visible while
    // the buyer fixes it is just noise.
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const found = validateCheckout(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Send focus to the problem rather than leaving it at the button.
      document
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          items: calculation.lines.map((line) => ({
            productId: line.item.productId,
            quantity: line.item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.fields) setErrors(result.fields as CheckoutErrors);
        setSubmitError(result.message ?? 'Could not place the order.');
        setSubmitting(false);
        return;
      }

      // Hold the confirmed state through the navigation so emptying the cart
      // does not flash "your cart is empty" on the way out.
      setPlaced(true);
      clear();
      router.push(`/order/${result.orderId}`);
    } catch {
      setSubmitError(
        'Could not reach the server. Your cart is unchanged — please try again.',
      );
      setSubmitting(false);
    }
  }

  if (!hasHydrated || placed) {
    return <div className="h-96 animate-pulse rounded-lg bg-surface-sunken" />;
  }

  if (calculation.lines.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-10 text-center">
        <h2 className="text-base font-semibold text-ink">Nothing to check out</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          Your cart is empty. Add products from a category first.
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {categories.slice(0, 4).map((category) => (
            <li key={category.id}>
              <Link
                href={`/products/${category.slug}`}
                className="inline-block rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-brand hover:text-brand"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <Section number={1} title="Invoice">
            <InvoiceTypeSelector
              value={values.invoiceType}
              onChange={(value) => update('invoiceType', value)}
            />

            {values.invoiceType === 'nip' ? (
              <div className="mt-5">
                <CompanyDetailsForm values={values} errors={errors} onChange={update} />
              </div>
            ) : null}
          </Section>

          <Section number={2} title="Delivery">
            <DeliveryAddressForm values={values} errors={errors} onChange={update} />
          </Section>

          <Section number={3} title="Confirm">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={values.consent}
                onChange={(event) => update('consent', event.target.checked)}
                aria-invalid={errors.consent ? true : undefined}
                className="mt-0.5 size-4 shrink-0 rounded border-line-strong text-brand focus:ring-brand"
              />
              <span className="text-ink-muted">
                I have read and accept the{' '}
                <Link href="/terms" className="text-brand underline-offset-2 hover:underline">
                  terms and conditions
                </Link>
                , and I am placing this order as a business.
              </span>
            </label>
            {errors.consent ? (
              <p role="alert" className="mt-1.5 text-xs text-stock-out">
                {errors.consent}
              </p>
            ) : null}

            {submitError ? (
              <p
                role="alert"
                className="mt-4 rounded-md border border-stock-out/40 bg-stock-out/5 px-3 py-2 text-sm text-stock-out"
              >
                {submitError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-ink-subtle sm:w-auto sm:px-8"
            >
              {submitting ? 'Placing order…' : 'Place order'}
            </button>

            <p className="mt-3 text-xs text-ink-muted">
              Placing the order issues a proforma invoice. No payment is taken now.
            </p>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <OrderSummary calculation={calculation} />
        </aside>
      </div>
    </form>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 flex items-center gap-2.5 text-lg font-semibold text-ink">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
