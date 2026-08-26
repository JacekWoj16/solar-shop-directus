import type { Metadata } from 'next';
import { Suspense } from 'react';

import { SearchBar } from '@/components/layout/SearchBar';

import { SearchResults, SearchSkeleton } from './SearchResults';

/**
 * Search.
 *
 * The only catalogue surface that is never prerendered, and the reason is
 * structural rather than a policy choice: the query space is unbounded, so
 * there is no finite set of pages to generate ahead of time. The heading and
 * the search box are static; everything downstream of `?q=` streams in.
 */
export const metadata: Metadata = {
  title: 'Search',
  description: 'Search the catalogue by product name, SKU, brand or description.',
  robots: { index: false, follow: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <div className="shell py-8">
      <h1 className="text-2xl text-ink sm:text-3xl">Search</h1>

      {/* Repeated here, not just in the header: after a search that missed, the
          box to refine it should be where the eye already is. */}
      <div className="mt-4 max-w-xl">
        <Suspense fallback={<div className="h-[38px] rounded-md bg-surface-sunken" />}>
          <SearchBoxWithTerm searchParams={searchParams} />
        </Suspense>
      </div>

      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** Pre-fills the box with the current query. */
async function SearchBoxWithTerm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { q } = await searchParams;
  return <SearchBar defaultValue={q ?? ''} />;
}
