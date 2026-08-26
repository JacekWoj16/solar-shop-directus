import type { Metadata } from 'next';

import { CartContents } from '@/components/cart/CartContents';
import { getCategories } from '@/lib/api';

/**
 * Cart page.
 *
 * The shell is prerendered: the heading and the category links shown to an
 * empty cart are the same for everyone. The cart itself is client-side, read
 * from `localStorage` after hydration — there is no server cart, no session and
 * nothing here that varies per request.
 */
export const metadata: Metadata = {
  title: 'Cart',
  description: 'Review quantities and volume pricing before checkout.',
};

export default async function CartPage() {
  const categories = await getCategories();

  return (
    <div className="shell py-8">
      <h1 className="text-2xl text-ink sm:text-3xl">Cart</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Quantities respect each category&rsquo;s minimum and step. Unit prices
        follow the volume bracket your quantity lands in.
      </p>

      <div className="mt-6">
        <CartContents categories={categories} />
      </div>
    </div>
  );
}
