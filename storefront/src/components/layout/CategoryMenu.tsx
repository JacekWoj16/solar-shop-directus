'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { formatQuantity } from '@/lib/format';
import type { Category } from '@/types/product';

/**
 * Category mega-menu — the primary navigation, mirroring how the original shop
 * put its entire range one click from anywhere.
 *
 * Click-driven rather than hover-driven: a hover menu is unusable on touch and
 * hostile to anyone who moves a pointer imprecisely. Hover opens it as well on
 * devices that actually have a hover-capable pointer.
 */
export function CategoryMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:text-brand aria-expanded:text-brand"
      >
        Products
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 w-[min(46rem,calc(100vw-2rem))] rounded-b-lg border border-t-0 border-line bg-surface p-2 shadow-lg">
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 transition-colors hover:bg-surface-sunken"
                >
                  <span className="block text-sm font-medium text-ink">
                    {category.name}
                  </span>
                  {category.min_quantity > 1 ? (
                    <span className="block text-xs text-ink-subtle">
                      min. {formatQuantity(category.min_quantity)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
