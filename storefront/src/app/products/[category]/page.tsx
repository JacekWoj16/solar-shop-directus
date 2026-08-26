import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ProductFilters } from '@/components/product/ProductFilters';
import { getCategories, getCategoryBySlug, getCategoryFacets } from '@/lib/api';
import { VAT_RATE } from '@/lib/constants';
import { formatNumber, formatPercent, formatQuantity } from '@/lib/format';

import { CategoryProducts, ProductTableSkeleton } from './CategoryProducts';

/**
 * Category product table.
 *
 * Split deliberately in two. Everything that depends only on the category —
 * breadcrumb, heading, description, the ordering rules — is prerendered per
 * category at build time. The table depends on `?sort` and `?page`, so it is
 * dynamic; wrapping it in `Suspense` lets Next serve the static shell
 * immediately and stream the table into it, rather than making the whole route
 * dynamic because one part of it varies.
 *
 * Cache lifetimes live on the queries themselves (`use cache` + `cacheLife` in
 * lib/api.ts), not on a route segment export.
 */
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

type PageProps = {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) return { title: 'Category not found' };

  return {
    title: category.name,
    description: category.description ?? undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  // Facets depend only on the category, so they belong to the prerendered
  // shell: the filter controls are visible immediately, before the table that
  // they act on has streamed in.
  const facets = await getCategoryFacets(slug);

  return (
    <div className="shell py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link href="/" className="transition-colors hover:text-brand">
          Home
        </Link>
        <span className="mx-2 text-ink-subtle">/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <header className="mt-4 border-b border-line pb-5">
        <h1 className="text-2xl text-ink sm:text-3xl">{category.name}</h1>

        {category.description ? (
          <p className="mt-2 max-w-3xl text-sm text-ink-muted">
            {category.description}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span>All prices net · VAT {formatPercent(VAT_RATE)} added at checkout</span>

          {/* Stating the ordering rules once, up front, saves the quantity
              field from having to explain itself on every row. */}
          {category.min_quantity > 1 ? (
            <span className="font-medium text-stock-low">
              Minimum order {formatQuantity(category.min_quantity)}
            </span>
          ) : null}
          {category.quantity_step > 1 ? (
            <span className="font-medium text-stock-low">
              Sold in multiples of {formatNumber(category.quantity_step, 0)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-x-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          {/* The filter controls read the URL through `useSearchParams`, which
              needs its own boundary so it cannot pull the shell into being
              rendered per request. */}
          <Suspense fallback={<FiltersSkeleton />}>
            <ProductFilters facets={facets} />
          </Suspense>
        </aside>

        <div className="min-w-0">
          <Suspense fallback={<ProductTableSkeleton />}>
            <CategoryProducts slug={slug} searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index}>
          <div className="h-3 w-20 animate-pulse rounded bg-surface-sunken" />
          <div className="mt-2 space-y-1.5">
            <div className="h-4 w-full animate-pulse rounded bg-surface-sunken" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-surface-sunken" />
          </div>
        </div>
      ))}
    </div>
  );
}
