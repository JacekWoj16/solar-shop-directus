import Link from 'next/link';

import type { Category } from '@/types/product';

/** Shown when the cart is empty — with a way out, not just an apology. */
export function EmptyCart({ categories }: { categories: Category[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-10 text-center">
      <h2 className="text-base font-semibold text-ink">Your cart is empty</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Add products from any category. Prices drop automatically as quantities
        cross each volume bracket.
      </p>

      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
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
