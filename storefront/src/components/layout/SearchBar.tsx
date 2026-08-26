/**
 * Catalogue search.
 *
 * A plain GET form rather than a controlled input with a router push: the
 * browser turns it into `/search?q=…` on its own, which means search works
 * before React hydrates and keeps this a server component. There is nothing
 * interactive here that the platform does not already do.
 */
export function SearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" role="search" className="flex w-full">
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>

      <input
        id="site-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search by name, SKU or brand…"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-l-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
      />

      <button
        type="submit"
        className="rounded-r-md border border-l-0 border-brand bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
      >
        Search
      </button>
    </form>
  );
}
