'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, useTransition } from 'react';

import { formatNumber } from '@/lib/format';
import {
  countActiveFilters,
  formatPowerBand,
  hasActiveFilters,
  parseFilters,
  powerBandLabel,
  powerBandsEqual,
  serializeFilters,
} from '@/lib/filters';
import type { CategoryFacets, PowerBand, ProductFilters as Filters } from '@/types/product';

interface ProductFiltersProps {
  facets: CategoryFacets;
}

/**
 * Category filter sidebar.
 *
 * Every control writes to the URL rather than to local state, so a filtered
 * table is a link that survives reload, sharing and the back button. Applying a
 * filter always drops the page number — page 7 of the old result set is
 * meaningless in the new one.
 *
 * Navigation runs inside a transition, so the current table stays on screen and
 * interactive while the next one is fetched instead of blanking out.
 */
export function ProductFilters({ facets }: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = parseFilters(Object.fromEntries(searchParams));
  const activeCount = countActiveFilters(filters);
  // Preserved across filter changes: reordering is a separate decision.
  const sort = searchParams.get('sort') ?? 'name_asc';

  const [mobileOpen, setMobileOpen] = useState(false);

  function apply(next: Filters) {
    const params = serializeFilters(next, { sort });
    const query = params.toString();

    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function toggleBrand(brand: string) {
    apply({
      ...filters,
      brands: filters.brands.includes(brand)
        ? filters.brands.filter((value) => value !== brand)
        : [...filters.brands, brand],
    });
  }

  function toggleBand(band: PowerBand) {
    apply({
      ...filters,
      power: filters.power.some((value) => powerBandsEqual(value, band))
        ? filters.power.filter((value) => !powerBandsEqual(value, band))
        : [...filters.power, band],
    });
  }

  const showPower = facets.powerBands.length > 0;
  const showPrice = facets.priceMin !== null && facets.priceMax !== null;

  return (
    <>
      {/* On narrow screens the filters collapse behind a button so the table,
          which is the reason for the page, is not pushed below the fold. */}
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink lg:hidden"
      >
        Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      <div
        className={`${mobileOpen ? 'block' : 'hidden'} space-y-6 lg:block ${
          isPending ? 'opacity-60' : ''
        } transition-opacity`}
      >
        {hasActiveFilters(filters) ? (
          <button
            type="button"
            onClick={() => apply(parseFilters({}))}
            className="text-sm font-medium text-brand underline-offset-2 hover:underline"
          >
            Clear all filters ({activeCount})
          </button>
        ) : null}

        {facets.brands.length > 1 ? (
          <FilterGroup title="Brand">
            <ul className="space-y-1.5">
              {facets.brands.map((brand) => (
                <li key={brand.name}>
                  <Checkbox
                    checked={filters.brands.includes(brand.name)}
                    onChange={() => toggleBrand(brand.name)}
                    label={brand.name}
                    hint={formatNumber(brand.count, 0)}
                  />
                </li>
              ))}
            </ul>
          </FilterGroup>
        ) : null}

        {showPower ? (
          <FilterGroup title="Power">
            <ul className="space-y-1.5">
              {facets.powerBands.map((band) => (
                <li key={formatPowerBand(band)}>
                  <Checkbox
                    checked={filters.power.some((value) => powerBandsEqual(value, band))}
                    onChange={() => toggleBand(band)}
                    label={powerBandLabel(band)}
                  />
                </li>
              ))}
            </ul>
          </FilterGroup>
        ) : null}

        {showPrice ? (
          <FilterGroup title="Unit price, net">
            <PriceRange
              min={facets.priceMin!}
              max={facets.priceMax!}
              valueMin={filters.priceMin}
              valueMax={filters.priceMax}
              onCommit={(priceMin, priceMax) => apply({ ...filters, priceMin, priceMax })}
            />
          </FilterGroup>
        ) : null}

        <FilterGroup title="Availability">
          <Checkbox
            checked={filters.inStockOnly}
            onChange={() =>
              apply({ ...filters, inStockOnly: !filters.inStockOnly })
            }
            label="In stock only"
          />
        </FilterGroup>
      </div>
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 rounded border-line-strong text-brand focus:ring-brand"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="shrink-0 text-xs text-ink-subtle">{hint}</span> : null}
    </label>
  );
}

/**
 * Min/max price inputs rather than a slider: a buyer working to a budget knows
 * the number they want, and a slider makes an exact figure hard to hit.
 * Committed on blur or Enter, never per keystroke — each commit is a navigation.
 */
function PriceRange({
  min,
  max,
  valueMin,
  valueMax,
  onCommit,
}: {
  min: number;
  max: number;
  valueMin: number | null;
  valueMax: number | null;
  onCommit: (min: number | null, max: number | null) => void;
}) {
  const minId = useId();
  const maxId = useId();

  const [lower, setLower] = useState(valueMin === null ? '' : String(valueMin));
  const [upper, setUpper] = useState(valueMax === null ? '' : String(valueMax));

  // Follow the URL when it changes from elsewhere — "clear all", the back
  // button — without an effect that would repaint twice.
  const [lastValues, setLastValues] = useState({ valueMin, valueMax });
  if (lastValues.valueMin !== valueMin || lastValues.valueMax !== valueMax) {
    setLastValues({ valueMin, valueMax });
    setLower(valueMin === null ? '' : String(valueMin));
    setUpper(valueMax === null ? '' : String(valueMax));
  }

  function commit() {
    const parse = (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    onCommit(parse(lower), parse(upper));
  }

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm tabular-nums text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <label htmlFor={minId} className="sr-only">
          Minimum price
        </label>
        <input
          id={minId}
          type="number"
          inputMode="numeric"
          value={lower}
          placeholder={String(min)}
          onChange={(event) => setLower(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
          className={inputClass}
        />
      </div>

      <span aria-hidden="true" className="text-ink-subtle">
        –
      </span>

      <div className="flex-1">
        <label htmlFor={maxId} className="sr-only">
          Maximum price
        </label>
        <input
          id={maxId}
          type="number"
          inputMode="numeric"
          value={upper}
          placeholder={String(max)}
          onChange={(event) => setUpper(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
          className={inputClass}
        />
      </div>
    </div>
  );
}
