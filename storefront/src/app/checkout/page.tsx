import type { Metadata } from 'next';

import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { getCategories } from '@/lib/api';

/**
 * Checkout.
 *
 * Prerendered shell, client island — same shape as the cart, and for the same
 * reason: the order being checked out lives in `localStorage`, and nothing on
 * the route varies per request.
 */
export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Invoice details, delivery address and order confirmation.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const categories = await getCategories();

  return (
    <div className="shell py-8">
      <h1 className="text-2xl text-ink sm:text-3xl">Checkout</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Trade sales only. Prices are net; VAT is added below. Payment is by bank
        transfer against the proforma invoice issued when you place the order.
      </p>

      <div className="mt-8">
        <CheckoutForm categories={categories} />
      </div>
    </div>
  );
}
