import Link from 'next/link';

import { CategoryFacet } from '@/components/product/CategoryFacet';
import { Pagination } from '@/components/product/Pagination';
import { ProductSort } from '@/components/product/ProductSort';
import { ProductTable } from '@/components/product/ProductTable';
import { getSearchFacets, searchProducts } from '@/lib/api';
import { PRODUCTS_PER_PAGE } from '@/lib/constants';
import { parseFilters } from '@/lib/filters';
import { formatNumber } from '@/lib/format';
import type { ProductSort as SortOption } from '@/types/product';

/**
 * Search results.
 *
 * Deliberately the same `ProductTable` the category pages use: a buyer who
 * found a module by typing its SKU should be able to set a quantity and add it
 * without first navigating into its category. Search is a way into the
 * catalogue, not a separate, lesser view of it.
 */

const SORT_OPTIONS = new Set<SortOption>([
  'name_asc',
  'name_desc',
  'price_asc',
  'price_desc',
  'sku_asc',
]);

function parseSort(value: string | undefined): SortOption {
  return value && SORT_OPTIONS.has(value as SortOption)
    ? (value as SortOption)
    : 'name_asc';
}

export async function SearchResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const term = (query.q ?? '').trim();

  if (!term) return <EmptyQuery />;

  const sort = parseSort(query.sort);
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const filters = parseFilters(query);

  const [{ products, total, pageCount }, facets] = await Promise.all([
    searchProducts({
      search: term,
      categorySlug: query.category,
      sort,
      page,
      brands: filters.brands,
      power: filters.power,
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      inStockOnly: filters.inStockOnly,
    }),
    // Facets are computed over the unfiltered match set, so the category chips
    // keep showing every option the query reaches.
    getSearchFacets(term),
  ]);

  if (total === 0) return <NoResults term={term} />;

  const firstOnPage = (page - 1) * PRODUCTS_PER_PAGE + 1;
  const lastOnPage = Math.min(page * PRODUCTS_PER_PAGE, total);

  return (
    <>
      <p className="mt-2 text-sm text-ink-muted">
        <span className="font-medium text-ink">{formatNumber(total, 0)}</span>{' '}
        {total === 1 ? 'product matches' : 'products match'}{' '}
        <span className="font-medium text-ink">&ldquo;{term}&rdquo;</span>
      </p>

      <div className="mt-6">
        <CategoryFacet facets={facets} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-sm text-ink-muted">
          Showing{' '}
          <span className="font-medium text-ink">
            {firstOnPage}&ndash;{lastOnPage}
          </span>{' '}
          of {formatNumber(total, 0)}
        </p>
        <ProductSort value={sort} />
      </div>

      <ProductTable products={products} />

      <Pagination
        page={page}
        pageCount={pageCount}
        searchParams={query}
        basePath="/search"
      />
    </>
  );
}

function EmptyQuery() {
  return (
    <div className="mt-8 rounded-lg border border-line bg-surface p-10 text-center">
      <h2 className="text-base font-semibold text-ink">What are you looking for?</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Search by product name, SKU, brand or description — for example{' '}
        <code className="font-mono text-xs text-ink">PNL-TRN</code>,{' '}
        <code className="font-mono text-xs text-ink">bifacial</code> or{' '}
        <code className="font-mono text-xs text-ink">Huawei</code>.
      </p>
    </div>
  );
}

function NoResults({ term }: { term: string }) {
  return (
    <div className="mt-8 rounded-lg border border-line bg-surface p-10 text-center">
      <h2 className="text-base font-semibold text-ink">
        Nothing matches &ldquo;{term}&rdquo;
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Try a shorter term, part of a SKU, or a manufacturer name. You can also
        browse the catalogue by category.
      </p>
      <Link
        href="/"
        className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand"
      >
        Browse categories
      </Link>
    </div>
  );
}

/** Placeholder while results are fetched. */
export function SearchSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="h-4 w-64 animate-pulse rounded bg-surface-sunken" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-7 w-28 animate-pulse rounded-full bg-surface-sunken" />
        ))}
      </div>
      <div className="space-y-2 pt-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-md bg-surface-sunken" />
        ))}
      </div>
    </div>
  );
}
