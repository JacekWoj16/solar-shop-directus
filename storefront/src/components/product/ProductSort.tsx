'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { ProductSort as SortOption } from '@/types/product';

const OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'sku_asc', label: 'SKU' },
];

/**
 * Sort control. Writes to the URL rather than to component state, so a sorted
 * table is a link a buyer can send to a colleague.
 */
export function ProductSort({ value }: { value: SortOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams);
    params.set('sort', next);
    // Any reordering invalidates the current page number.
    params.delete('page');
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-ink-muted">
      Sort
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
