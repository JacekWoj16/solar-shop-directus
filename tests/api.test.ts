import { describe, expect, it } from 'vitest';

import {
  normalizeCategory,
  normalizeProduct,
  toNullableNumber,
  toNumber,
} from '@/lib/api';
import { getUnitPrice } from '@/lib/pricing';
import { formatPrice } from '@/lib/format';

/**
 * Directus over PostgreSQL returns `numeric` columns as *strings* — the driver
 * will not risk precision loss through a float. These tests pin the normalisation
 * that turns them back into numbers, because the failure mode is quiet: string
 * arithmetic coerces and looks fine, while `Number.isFinite("346.50")` is false
 * and every formatted price silently renders as zero.
 */

/** A product exactly as the REST API returns it. */
const rawProduct = {
  id: 'b3f1c8e2-0000-4000-8000-000000000001',
  sku: 'PNL-TRN-N715',
  name: 'Vertex N 715W TSM-NEG21C.20 N-Type bifacial',
  brand: 'Trina Solar',
  description: 'Net trade price, VAT added at checkout.',
  image_url: 'https://picsum.photos/seed/pnl-trn-n715/400/400.webp',
  power_watts: 715,
  stock_status: 'in_stock',
  is_active: true,
  sort_order: 13,
  date_created: '2026-08-25T18:00:00.000Z',
  date_updated: null,
  category: {
    id: 'a1f1c8e2-0000-4000-8000-000000000001',
    name: 'Solar Panels',
    slug: 'solar-panels',
    description: 'Monocrystalline and bifacial modules.',
    min_quantity: 5,
    quantity_step: 1,
    sort_order: 1,
    is_active: true,
  },
  price_tiers: [
    { id: 't1', min_quantity: 5, max_quantity: 49, unit_price: '346.50', sort_order: 1 },
    { id: 't2', min_quantity: 50, max_quantity: 199, unit_price: '332.64', sort_order: 2 },
    { id: 't3', min_quantity: 200, max_quantity: 499, unit_price: '320.51', sort_order: 3 },
    { id: 't4', min_quantity: 500, max_quantity: null, unit_price: '304.92', sort_order: 4 },
  ],
};

describe('toNumber', () => {
  it('parses the strings PostgreSQL returns for numeric columns', () => {
    expect(toNumber('346.50')).toBe(346.5);
    expect(toNumber('0.00')).toBe(0);
    expect(toNumber('-12.34')).toBe(-12.34);
  });

  it('passes finite numbers through', () => {
    expect(toNumber(346.5)).toBe(346.5);
    expect(toNumber(0)).toBe(0);
  });

  it('falls back for values that are not numbers at all', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(null, 1)).toBe(1);
  });
});

describe('toNullableNumber', () => {
  it('preserves a genuine null rather than collapsing it to zero', () => {
    // max_quantity null means "open-ended top tier"; power_watts null means
    // "not a panel". Either turning into 0 would change the meaning.
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
    expect(toNullableNumber('')).toBeNull();
  });

  it('parses present values', () => {
    expect(toNullableNumber('499')).toBe(499);
    expect(toNullableNumber(715)).toBe(715);
  });

  it('returns null for unparseable input', () => {
    expect(toNullableNumber('n/a')).toBeNull();
  });
});

describe('normalizeCategory', () => {
  it('maps a raw category', () => {
    const category = normalizeCategory(rawProduct.category);

    expect(category.slug).toBe('solar-panels');
    expect(category.min_quantity).toBe(5);
    expect(category.quantity_step).toBe(1);
    expect(category.is_active).toBe(true);
  });

  it('never yields a zero minimum or step', () => {
    const category = normalizeCategory({ min_quantity: 0, quantity_step: 0 });
    expect(category.min_quantity).toBe(1);
    expect(category.quantity_step).toBe(1);
  });

  it('defaults is_active to true when the field is absent', () => {
    expect(normalizeCategory({}).is_active).toBe(true);
    expect(normalizeCategory({ is_active: false }).is_active).toBe(false);
  });
});

describe('normalizeProduct', () => {
  it('converts every tier price from string to number', () => {
    const product = normalizeProduct(rawProduct);

    expect(product.price_tiers.map((tier) => tier.unit_price)).toEqual([
      346.5, 332.64, 320.51, 304.92,
    ]);
    product.price_tiers.forEach((tier) => {
      expect(typeof tier.unit_price).toBe('number');
    });
  });

  it('keeps the open-ended top tier open', () => {
    const product = normalizeProduct(rawProduct);
    expect(product.price_tiers.at(-1)!.max_quantity).toBeNull();
  });

  it('produces tiers the pricing layer can actually price', () => {
    const product = normalizeProduct(rawProduct);

    expect(getUnitPrice(product.price_tiers, 5)).toBe(346.5);
    expect(getUnitPrice(product.price_tiers, 200)).toBe(320.51);
    expect(getUnitPrice(product.price_tiers, 5000)).toBe(304.92);
  });

  it('produces prices that format instead of collapsing to zero', () => {
    const product = normalizeProduct(rawProduct);
    const unitPrice = getUnitPrice(product.price_tiers, 5)!;

    // \u00A0 is the no-break space formatPrice puts before the currency.
    expect(formatPrice(unitPrice)).toBe('346,50\u00A0zł');
    // The bug this guards against: the raw string would format as "0,00 zł".
    expect(formatPrice(rawProduct.price_tiers[0]!.unit_price as never)).toBe(
      '0,00\u00A0zł',
    );
  });

  it('expands the category', () => {
    expect(normalizeProduct(rawProduct).category.slug).toBe('solar-panels');
  });

  it('keeps power_watts null for non-panel products', () => {
    const inverter = normalizeProduct({ ...rawProduct, power_watts: null });
    expect(inverter.power_watts).toBeNull();
  });

  it('survives a product with no tiers', () => {
    const product = normalizeProduct({ ...rawProduct, price_tiers: [] });
    expect(product.price_tiers).toEqual([]);
    expect(getUnitPrice(product.price_tiers, 10)).toBeNull();
  });

  it('treats a missing stock status as out of stock', () => {
    const product = normalizeProduct({ ...rawProduct, stock_status: undefined });
    expect(product.stock_status).toBe('out_of_stock');
  });
});
