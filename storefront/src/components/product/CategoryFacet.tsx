'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { formatNumber } from '@/lib/format';
import type { CategoryFacets } from '@/types/product';

/**
 * Category breakdown of a search result set.
 *
 * Search runs across the whole catalogue, so a query like "10" or "black"
 * legitimately matches panels, cables and accessories at once. This turns that
 * from noise into navigation: the counts say where the matches actually are,
 * and picking one narrows without re-typing the query.
 *
 * Shown only when results span more than one category — a facet with a single
 * option filters nothing.
 */
export function CategoryFacet({ facets }: { facets: CategoryFacets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (facets.categories.length < 2) return null;

  const selected = searchParams.get('category');
  const total = facets.categories.reduce((sum, entry) => sum + entry.count, 0);

  function select(slug: string | null) {
    const params = new URLSearchParams(searchParams);
    if (slug) params.set('category', slug);
    else params.delete('category');
    // A different result set invalidates the page number.
    params.delete('page');

    startTransition(() => {
      router.push(`${pathname}?${params}`, { scroll: false });
    });
  }

  const chip =
    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors';

  return (
    <div className={`${isPending ? 'opacity-60' : ''} transition-opacity`}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        Categories
      </h2>

      <ul className="flex flex-wrap gap-2">
        <li>
          <button
            type="button"
            onClick={() => select(null)}
            aria-pressed={!selected}
            className={`${chip} ${
              selected
                ? 'border-line bg-surface text-ink hover:border-brand hover:text-brand'
                : 'border-brand bg-brand text-white'
            }`}
          >
            All · {formatNumber(total, 0)}
          </button>
        </li>

        {facets.categories.map((category) => {
          const active = selected === category.slug;

          return (
            <li key={category.slug}>
              <button
                type="button"
                onClick={() => select(category.slug)}
                aria-pressed={active}
                className={`${chip} ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface text-ink hover:border-brand hover:text-brand'
                }`}
              >
                {category.name} · {formatNumber(category.count, 0)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
