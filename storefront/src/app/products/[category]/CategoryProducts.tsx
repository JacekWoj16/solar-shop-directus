import { Pagination } from '@/components/product/Pagination';
import { ProductSort } from '@/components/product/ProductSort';
import { ProductTable } from '@/components/product/ProductTable';
import { getProducts } from '@/lib/api';
import { PRODUCTS_PER_PAGE } from '@/lib/constants';
import { parseFilters } from '@/lib/filters';
import { formatNumber } from '@/lib/format';
import type { ProductSort as SortOption } from '@/types/product';

/**
 * The dynamic half of a category page: the table, its result count, its sort
 * control and its pagination. Reads `searchParams`, which is what makes it
 * dynamic — it is rendered inside a `Suspense` boundary so the rest of the page
 * can still be prerendered.
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

interface CategoryProductsProps {
  slug: string;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function CategoryProducts({ slug, searchParams }: CategoryProductsProps) {
  const query = await searchParams;

  const sort = parseSort(query.sort);
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const filters = parseFilters(query);

  const { products, total, pageCount } = await getProducts({
    categorySlug: slug,
    sort,
    page,
    brands: filters.brands,
    power: filters.power,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    inStockOnly: filters.inStockOnly,
  });

  const firstOnPage = total === 0 ? 0 : (page - 1) * PRODUCTS_PER_PAGE + 1;
  const lastOnPage = Math.min(page * PRODUCTS_PER_PAGE, total);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="text-sm text-ink-muted">
          {total > 0 ? (
            <>
              Showing{' '}
              <span className="font-medium text-ink">
                {firstOnPage}–{lastOnPage}
              </span>{' '}
              of {formatNumber(total, 0)} products
            </>
          ) : (
            'No products match these filters.'
          )}
        </p>

        <ProductSort value={sort} />
      </div>

      <ProductTable products={products} />

      <Pagination
        page={page}
        pageCount={pageCount}
        searchParams={query}
        basePath={`/products/${slug}`}
      />
    </>
  );
}

/** Placeholder shown while the table streams in. */
export function ProductTableSkeleton() {
  return (
    <div className="py-4">
      <div className="h-9 w-56 animate-pulse rounded-md bg-surface-sunken" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-md bg-surface-sunken"
          />
        ))}
      </div>
    </div>
  );
}
