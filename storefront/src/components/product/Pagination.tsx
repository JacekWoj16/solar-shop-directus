import Link from 'next/link';

interface PaginationProps {
  page: number;
  pageCount: number;
  /** Current query string, so filters and sort survive a page change. */
  searchParams: Record<string, string | undefined>;
  basePath: string;
}

/**
 * Page links.
 *
 * Plain anchors, not buttons: each page is a real URL that can be bookmarked,
 * shared and crawled, and paging works with JavaScript disabled.
 */
export function Pagination({ page, pageCount, searchParams, basePath }: PaginationProps) {
  if (pageCount <= 1) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    if (target > 1) params.set('page', String(target));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  // A sliding window keeps the control a fixed width on long catalogues.
  const windowSize = 5;
  const start = Math.max(1, Math.min(page - 2, pageCount - windowSize + 1));
  const end = Math.min(pageCount, start + windowSize - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  const linkClass =
    'inline-flex min-w-9 items-center justify-center rounded-md border border-line px-2.5 py-1.5 text-sm transition-colors hover:border-brand hover:text-brand';

  return (
    <nav aria-label="Pagination" className="mt-6 flex flex-wrap items-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClass}>
          Previous
        </Link>
      ) : null}

      {start > 1 ? (
        <>
          <Link href={hrefFor(1)} className={linkClass}>
            1
          </Link>
          {start > 2 ? <span className="px-1 text-ink-subtle">…</span> : null}
        </>
      ) : null}

      {pages.map((target) =>
        target === page ? (
          <span
            key={target}
            aria-current="page"
            className="inline-flex min-w-9 items-center justify-center rounded-md border border-brand bg-brand px-2.5 py-1.5 text-sm font-medium text-white"
          >
            {target}
          </span>
        ) : (
          <Link key={target} href={hrefFor(target)} className={linkClass}>
            {target}
          </Link>
        ),
      )}

      {end < pageCount ? (
        <>
          {end < pageCount - 1 ? <span className="px-1 text-ink-subtle">…</span> : null}
          <Link href={hrefFor(pageCount)} className={linkClass}>
            {pageCount}
          </Link>
        </>
      ) : null}

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
          Next
        </Link>
      ) : null}
    </nav>
  );
}
