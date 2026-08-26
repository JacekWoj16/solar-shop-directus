import Link from 'next/link';

import { getCategories } from '@/lib/api';

import { CartIcon } from './CartIcon';
import { CategoryMenu } from './CategoryMenu';
import { SearchBar } from './SearchBar';

/**
 * Site header.
 *
 * An async server component: the category list it needs is the same list every
 * page already caches, so fetching it here costs nothing extra and keeps the
 * menu out of the client bundle apart from its open/close state.
 *
 * `getCategories` carries the longer `structure` cache profile: the set of
 * categories is the shop's shape and changes far more slowly than its stock.
 * That matters more here than anywhere else, because the header renders on
 * every page — a short lifetime on this one query would keep the whole site
 * revalidating for data that had not moved.
 */
export async function Header() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="shell">
        <div className="flex items-center gap-4 py-3">
          <Link href="/" className="shrink-0">
            <span className="block text-lg font-semibold leading-none tracking-tight text-ink">
              SOLARIS
            </span>
            <span className="block text-[0.6875rem] uppercase tracking-[0.18em] text-ink-subtle">
              Components
            </span>
          </Link>

          <div className="hidden flex-1 md:block">
            <SearchBar />
          </div>

          <div className="ml-auto md:ml-0">
            <CartIcon />
          </div>
        </div>

        {/* Search moves onto its own row where the header would otherwise be
            too cramped to type in. */}
        <div className="pb-3 md:hidden">
          <SearchBar />
        </div>

        <nav className="-mx-3 flex items-center gap-1 border-t border-line/70">
          <CategoryMenu categories={categories} />

          <Link
            href="/about"
            className="px-3 py-2.5 text-sm text-ink-muted transition-colors hover:text-brand"
          >
            About
          </Link>
          <Link
            href="/contact"
            className="px-3 py-2.5 text-sm text-ink-muted transition-colors hover:text-brand"
          >
            Contact
          </Link>
          <Link
            href="/terms"
            className="px-3 py-2.5 text-sm text-ink-muted transition-colors hover:text-brand"
          >
            Terms
          </Link>

          <span className="ml-auto hidden px-3 py-2.5 text-xs text-ink-subtle lg:block">
            Net prices · VAT 23% added at checkout
          </span>
        </nav>
      </div>
    </header>
  );
}
