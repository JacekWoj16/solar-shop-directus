import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  buildPowerBands,
  countActiveFilters,
  formatPowerBand,
  hasActiveFilters,
  parseFilters,
  parsePowerBand,
  powerBandLabel,
  serializeFilters,
} from '@/lib/filters';
import type { ProductFilters } from '@/types/product';

/**
 * Filter state is spelled into the URL, which means it is public API: people
 * bookmark it and paste it to each other. These tests pin the spelling and,
 * more importantly, pin that a mangled URL degrades into a usable page instead
 * of throwing.
 */

describe('parsePowerBand', () => {
  it('reads a bounded band', () => {
    expect(parsePowerBand('400-450')).toEqual({ min: 400, max: 450 });
  });

  it('reads an open-ended band', () => {
    expect(parsePowerBand('600-')).toEqual({ min: 600, max: null });
  });

  it('rejects malformed input rather than guessing', () => {
    expect(parsePowerBand('')).toBeNull();
    expect(parsePowerBand('400')).toBeNull();
    expect(parsePowerBand('abc-def')).toBeNull();
    expect(parsePowerBand('-450')).toBeNull();
    // A band whose upper bound is below its lower bound can match nothing.
    expect(parsePowerBand('500-400')).toBeNull();
  });

  it('round-trips through formatPowerBand', () => {
    for (const value of ['400-450', '600-']) {
      expect(formatPowerBand(parsePowerBand(value)!)).toBe(value);
    }
  });
});

describe('powerBandLabel', () => {
  it('reads the way a spec sheet does', () => {
    expect(powerBandLabel({ min: 400, max: 450 })).toBe('400–450 W');
    expect(powerBandLabel({ min: 600, max: null })).toBe('600 W+');
  });
});

describe('parseFilters', () => {
  it('returns empty filters for an empty query', () => {
    expect(parseFilters({})).toEqual(EMPTY_FILTERS);
  });

  it('reads every filter', () => {
    const filters = parseFilters({
      brand: 'Jinko Solar,Trina Solar',
      power: '400-450,600-',
      price_min: '250',
      price_max: '400',
      in_stock: '1',
    });

    expect(filters.brands).toEqual(['Jinko Solar', 'Trina Solar']);
    expect(filters.power).toEqual([
      { min: 400, max: 450 },
      { min: 600, max: null },
    ]);
    expect(filters.priceMin).toBe(250);
    expect(filters.priceMax).toBe(400);
    expect(filters.inStockOnly).toBe(true);
  });

  it('drops duplicate and blank brands', () => {
    expect(parseFilters({ brand: 'Jinko,,Jinko, Trina ' }).brands).toEqual([
      'Jinko',
      'Trina',
    ]);
  });

  it('discards unparseable power bands but keeps the good ones', () => {
    expect(parseFilters({ power: '400-450,nonsense,600-' }).power).toEqual([
      { min: 400, max: 450 },
      { min: 600, max: null },
    ]);
  });

  it('swaps a reversed price range instead of returning nothing', () => {
    const filters = parseFilters({ price_min: '400', price_max: '250' });
    expect(filters.priceMin).toBe(250);
    expect(filters.priceMax).toBe(400);
  });

  it('ignores junk and negative bounds', () => {
    expect(parseFilters({ price_min: 'abc' }).priceMin).toBeNull();
    expect(parseFilters({ price_min: '-50' }).priceMin).toBeNull();
    expect(parseFilters({ price_min: '' }).priceMin).toBeNull();
  });

  it('treats any in_stock value other than 1 as off', () => {
    expect(parseFilters({ in_stock: '1' }).inStockOnly).toBe(true);
    expect(parseFilters({ in_stock: 'true' }).inStockOnly).toBe(false);
    expect(parseFilters({ in_stock: '0' }).inStockOnly).toBe(false);
  });

  it('accepts a repeated query key by taking the first value', () => {
    expect(parseFilters({ brand: ['Jinko', 'Trina'] }).brands).toEqual(['Jinko']);
  });
});

describe('serializeFilters', () => {
  const filters: ProductFilters = {
    brands: ['Jinko Solar'],
    power: [{ min: 600, max: null }],
    priceMin: 250,
    priceMax: null,
    inStockOnly: true,
  };

  it('writes only what is set', () => {
    expect(serializeFilters(filters).toString()).toBe(
      'brand=Jinko+Solar&power=600-&price_min=250&in_stock=1',
    );
  });

  it('leaves a default view as a clean URL', () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe('');
  });

  it('omits the default sort and the first page', () => {
    expect(
      serializeFilters(EMPTY_FILTERS, { sort: 'name_asc', page: 1 }).toString(),
    ).toBe('');
    expect(serializeFilters(EMPTY_FILTERS, { sort: 'price_asc' }).toString()).toBe(
      'sort=price_asc',
    );
    expect(serializeFilters(EMPTY_FILTERS, { page: 3 }).toString()).toBe('page=3');
  });

  it('round-trips through parseFilters', () => {
    const query = Object.fromEntries(serializeFilters(filters));
    expect(parseFilters(query)).toEqual(filters);
  });
});

describe('hasActiveFilters / countActiveFilters', () => {
  it('reports nothing active for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('counts a price range as one filter regardless of which end is set', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, priceMin: 100 })).toBe(1);
    expect(countActiveFilters({ ...EMPTY_FILTERS, priceMax: 100 })).toBe(1);
    expect(
      countActiveFilters({ ...EMPTY_FILTERS, priceMin: 100, priceMax: 200 }),
    ).toBe(1);
  });

  it('counts brands and bands individually', () => {
    expect(
      countActiveFilters({
        ...EMPTY_FILTERS,
        brands: ['Jinko', 'Trina'],
        power: [{ min: 600, max: null }],
        inStockOnly: true,
      }),
    ).toBe(4);
  });
});

describe('buildPowerBands', () => {
  it('covers the observed range in even steps, leaving the top open', () => {
    expect(buildPowerBands(425, 715)).toEqual([
      { min: 400, max: 450 },
      { min: 450, max: 500 },
      { min: 500, max: 550 },
      { min: 550, max: 600 },
      { min: 600, max: 650 },
      { min: 650, max: 700 },
      { min: 700, max: null },
    ]);
  });

  it('offers no bands when everything falls in one', () => {
    // A filter with a single option filters nothing.
    expect(buildPowerBands(430, 445)).toEqual([]);
    expect(buildPowerBands(500, 500)).toEqual([]);
  });

  it('honours a custom step', () => {
    expect(buildPowerBands(400, 600, 100)).toEqual([
      { min: 400, max: 500 },
      { min: 500, max: 600 },
      { min: 600, max: null },
    ]);
  });

  it('returns nothing for an impossible or absent range', () => {
    expect(buildPowerBands(600, 400)).toEqual([]);
    expect(buildPowerBands(Number.NaN, 500)).toEqual([]);
  });
});
