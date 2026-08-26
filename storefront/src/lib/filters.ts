import type { PowerBand, ProductFilters } from '@/types/product';

/**
 * Filter state lives in the URL, not in component state.
 *
 * A filtered table is then a link: a buyer can send "the 500 W+ Jinko modules
 * you have in stock" to a colleague, bookmark it, or reload without losing it.
 * This module is the single place that knows how that state is spelled, and it
 * is pure — parsing and serialising are tested without a router or a DOM.
 */

/** Query-string keys. Short, because these end up in shared links. */
export const FILTER_KEYS = {
  brand: 'brand',
  power: 'power',
  priceMin: 'price_min',
  priceMax: 'price_max',
  inStock: 'in_stock',
  sort: 'sort',
  page: 'page',
} as const;

export const EMPTY_FILTERS: ProductFilters = {
  brands: [],
  power: [],
  priceMin: null,
  priceMax: null,
  inStockOnly: false,
};

/** `"400-450"` → `{ min: 400, max: 450 }`; `"600-"` → `{ min: 600, max: null }`. */
export function parsePowerBand(value: string): PowerBand | null {
  const match = /^(\d+)-(\d*)$/.exec(value.trim());
  if (!match) return null;

  const min = Number(match[1]);
  const max = match[2] ? Number(match[2]) : null;

  if (!Number.isFinite(min)) return null;
  if (max !== null && (!Number.isFinite(max) || max < min)) return null;

  return { min, max };
}

export function formatPowerBand(band: PowerBand): string {
  return `${band.min}-${band.max ?? ''}`;
}

/** Human-readable band label: `400–450 W`, `600 W+`. */
export function powerBandLabel(band: PowerBand): string {
  return band.max === null ? `${band.min} W+` : `${band.min}–${band.max} W`;
}

export function powerBandsEqual(a: PowerBand, b: PowerBand): boolean {
  return a.min === b.min && a.max === b.max;
}

/** Parses a positive number, rejecting junk and negatives. */
function parseBound(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

type Query = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads filters out of a query object.
 *
 * Deliberately forgiving: a hand-edited or truncated URL should drop the parts
 * it cannot understand and still render a usable page, never throw.
 */
export function parseFilters(query: Query): ProductFilters {
  const brands = (first(query[FILTER_KEYS.brand]) ?? '')
    .split(',')
    .map((brand) => brand.trim())
    .filter(Boolean);

  const power = (first(query[FILTER_KEYS.power]) ?? '')
    .split(',')
    .map((value) => parsePowerBand(value))
    .filter((band): band is PowerBand => band !== null);

  let priceMin = parseBound(first(query[FILTER_KEYS.priceMin]));
  let priceMax = parseBound(first(query[FILTER_KEYS.priceMax]));

  // A reversed range is a typo, not a request for no results.
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  return {
    brands: [...new Set(brands)],
    power,
    priceMin,
    priceMax,
    inStockOnly: first(query[FILTER_KEYS.inStock]) === '1',
  };
}

/**
 * Writes filters into a query string, omitting anything unset so a default
 * view stays a clean URL.
 */
export function serializeFilters(
  filters: ProductFilters,
  extra: { sort?: string; page?: number } = {},
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.brands.length) {
    params.set(FILTER_KEYS.brand, filters.brands.join(','));
  }
  if (filters.power.length) {
    params.set(FILTER_KEYS.power, filters.power.map(formatPowerBand).join(','));
  }
  if (filters.priceMin !== null) {
    params.set(FILTER_KEYS.priceMin, String(filters.priceMin));
  }
  if (filters.priceMax !== null) {
    params.set(FILTER_KEYS.priceMax, String(filters.priceMax));
  }
  if (filters.inStockOnly) {
    params.set(FILTER_KEYS.inStock, '1');
  }

  if (extra.sort && extra.sort !== 'name_asc') {
    params.set(FILTER_KEYS.sort, extra.sort);
  }
  // Changing a filter always invalidates the page number, so page 1 is never
  // written back into the URL.
  if (extra.page && extra.page > 1) {
    params.set(FILTER_KEYS.page, String(extra.page));
  }

  return params;
}

export function hasActiveFilters(filters: ProductFilters): boolean {
  return (
    filters.brands.length > 0 ||
    filters.power.length > 0 ||
    filters.priceMin !== null ||
    filters.priceMax !== null ||
    filters.inStockOnly
  );
}

/** How many filters are applied, for the mobile "Filters (3)" button. */
export function countActiveFilters(filters: ProductFilters): number {
  return (
    filters.brands.length +
    filters.power.length +
    (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0)
  );
}

/**
 * Divides an observed wattage range into checkbox bands.
 *
 * Bands are derived from the data rather than hard-coded, so a category of
 * 400–700 W modules does not offer a "200–250 W" filter that can only ever
 * return nothing. The highest band is left open-ended.
 */
export function buildPowerBands(
  min: number,
  max: number,
  size = 50,
): PowerBand[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];

  const start = Math.floor(min / size) * size;
  const end = Math.floor(max / size) * size;

  // Everything sits in one band: not worth offering as a filter at all.
  if (start === end) return [];

  const bands: PowerBand[] = [];
  for (let lower = start; lower < end; lower += size) {
    bands.push({ min: lower, max: lower + size });
  }
  bands.push({ min: end, max: null });

  return bands;
}
