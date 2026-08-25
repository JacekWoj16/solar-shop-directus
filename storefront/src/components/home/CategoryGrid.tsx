import Link from 'next/link';

import { formatQuantity } from '@/lib/format';
import type { Category } from '@/types/product';

/**
 * Category tiles — the primary way into the catalogue, mirroring how the
 * original shop put its whole range one click from the home page.
 *
 * A server component: the data is fetched on the page and passed down, so no
 * catalogue query reaches the browser.
 */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">
        No categories are published yet. Seed Directus with{' '}
        <code className="font-mono text-xs text-ink">npm run seed</code>.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            href={`/products/${category.slug}`}
            className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 transition-colors hover:border-brand hover:bg-brand-soft/30"
          >
            <h3 className="text-base font-semibold text-ink group-hover:text-brand">
              {category.name}
            </h3>

            {category.description ? (
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-muted">
                {category.description}
              </p>
            ) : null}

            {/* Surfacing the pallet minimum here saves a buyer the trip into a
                category they cannot order from in the quantity they wanted. */}
            {category.min_quantity > 1 ? (
              <p className="mt-3 text-xs font-medium text-ink-subtle">
                Minimum order {formatQuantity(category.min_quantity)}
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
