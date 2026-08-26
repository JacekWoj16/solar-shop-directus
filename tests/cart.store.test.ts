// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import { useCartStore } from '@/stores/cart.store';
import { calculateCartTotal } from '@/lib/pricing';

import { category, product, tier } from './fixtures';

/**
 * Store-level tests, in a DOM environment.
 *
 * The pure cart rules are covered in `cart.test.ts`; what is exercised here is
 * the part that only exists once a store and a browser are involved —
 * persistence to `localStorage`, the hydration flag the UI keys off, and the
 * fact that quantities are re-normalised on write rather than trusted from
 * whatever was stored last time.
 */

const STORAGE_KEY = 'solar-shop-cart';

/** Solar panels: minimum five, one at a time. */
const panel = product({
  id: 'panel-1',
  sku: 'PNL-TRN-N715',
  category: category({ min_quantity: 5, quantity_step: 1 }),
  price_tiers: [
    tier(5, 49, 346.5),
    tier(50, 199, 332.64),
    tier(200, null, 320.51),
  ],
});

/**
 * A cable sold by the pack of ten rolls: the first orderable quantity is 10 and
 * it moves in tens. Note that `min` is the first allowed value and `step` the
 * increment above it, so min 1 / step 10 would mean 1, 11, 21 — consistent, but
 * not what "sold in tens" means.
 */
const cable = product({
  id: 'cable-1',
  sku: 'CBL-HEL-S6B',
  name: 'Solarflex 6 mm2, 10 m roll',
  power_watts: null,
  category: category({
    id: 'cat-cables',
    name: 'Cables & Connectors',
    slug: 'cables-connectors',
    min_quantity: 10,
    quantity_step: 10,
  }),
  price_tiers: [tier(1, 49, 49.8), tier(50, null, 43.82)],
});

beforeEach(() => {
  window.localStorage.clear();
  useCartStore.setState({ items: [], hasHydrated: true });
});

describe('adding', () => {
  it('adds at the category minimum when no quantity is given', () => {
    useCartStore.getState().add(panel);

    const [line] = useCartStore.getState().items;
    expect(line!.quantity).toBe(5);
    expect(line!.sku).toBe('PNL-TRN-N715');
  });

  it('snapshots the rules and tiers, so the cart prices itself offline', () => {
    useCartStore.getState().add(panel);

    const [line] = useCartStore.getState().items;
    expect(line!.minQuantity).toBe(5);
    expect(line!.quantityStep).toBe(1);
    expect(line!.tiers).toHaveLength(3);
    expect(line!.categorySlug).toBe('solar-panels');
  });

  it('accumulates instead of resetting when the same product is added twice', () => {
    useCartStore.getState().add(panel, 20);
    useCartStore.getState().add(panel, 40);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0]!.quantity).toBe(60);
  });

  it('raises a below-minimum request to the minimum', () => {
    useCartStore.getState().add(panel, 2);
    expect(useCartStore.getState().items[0]!.quantity).toBe(5);
  });

  it('keeps products from different categories on separate lines', () => {
    useCartStore.getState().add(panel, 10);
    useCartStore.getState().add(cable, 20);

    expect(useCartStore.getState().items.map((item) => item.sku)).toEqual([
      'PNL-TRN-N715',
      'CBL-HEL-S6B',
    ]);
  });
});

describe('quantity changes', () => {
  it('steps by the category step, per line', () => {
    useCartStore.getState().add(panel, 10);
    useCartStore.getState().add(cable, 10);

    useCartStore.getState().increment('panel-1');
    useCartStore.getState().increment('cable-1');

    const items = useCartStore.getState().items;
    expect(items.find((i) => i.productId === 'panel-1')!.quantity).toBe(11);
    expect(items.find((i) => i.productId === 'cable-1')!.quantity).toBe(20);
  });

  it('never decrements below the minimum', () => {
    useCartStore.getState().add(panel);
    useCartStore.getState().decrement('panel-1');
    expect(useCartStore.getState().items[0]!.quantity).toBe(5);
  });

  it('removes the line when the quantity is set to zero', () => {
    useCartStore.getState().add(panel, 10);
    useCartStore.getState().setQuantity('panel-1', 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('ignores actions for a product that is not in the cart', () => {
    useCartStore.getState().add(panel, 10);
    useCartStore.getState().increment('missing');
    useCartStore.getState().decrement('missing');
    expect(useCartStore.getState().items[0]!.quantity).toBe(10);
  });
});

describe('pricing through the store', () => {
  it('reprices a line as its quantity crosses a bracket', () => {
    useCartStore.getState().add(panel, 10);
    expect(calculateCartTotal(useCartStore.getState().items).lines[0]!.unitPrice).toBe(346.5);

    useCartStore.getState().setQuantity('panel-1', 50);
    expect(calculateCartTotal(useCartStore.getState().items).lines[0]!.unitPrice).toBe(332.64);

    useCartStore.getState().setQuantity('panel-1', 200);
    expect(calculateCartTotal(useCartStore.getState().items).lines[0]!.unitPrice).toBe(320.51);
  });

  it('totals a mixed cart with VAT applied once on the net subtotal', () => {
    useCartStore.getState().add(panel, 50); // 50 x 332.64 = 16 632.00
    useCartStore.getState().add(cable, 50); // 50 x  43.82 =  2 191.00

    const result = calculateCartTotal(useCartStore.getState().items);

    expect(result.subtotalNet).toBe(18823);
    expect(result.vatAmount).toBe(4329.29);
    expect(result.totalGross).toBe(23152.29);
    expect(result.totalQuantity).toBe(100);
  });

  it('surfaces a nudge when a line is just short of a better bracket', () => {
    useCartStore.getState().add(panel, 47);

    const [line] = calculateCartTotal(useCartStore.getState().items).lines;
    expect(line!.nudge).not.toBeNull();
    expect(line!.nudge!.unitsNeeded).toBe(3);
    expect(line!.nudge!.targetQuantity).toBe(50);
  });
});

describe('persistence', () => {
  it('writes the cart to localStorage', () => {
    useCartStore.getState().add(panel, 10);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.state.items).toHaveLength(1);
    expect(stored.state.items[0].quantity).toBe(10);
    expect(stored.version).toBe(1);
  });

  it('does not persist the hydration flag, which is derived', () => {
    useCartStore.getState().add(panel, 10);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.state.hasHydrated).toBeUndefined();
  });

  it('re-normalises a stored quantity that the category no longer allows', () => {
    // A cart saved before the minimum was raised to 5.
    useCartStore.setState({
      items: [
        {
          productId: 'panel-1',
          sku: 'PNL-TRN-N715',
          name: panel.name,
          brand: panel.brand,
          imageUrl: null,
          categorySlug: 'solar-panels',
          categoryName: 'Solar Panels',
          minQuantity: 5,
          quantityStep: 1,
          tiers: panel.price_tiers,
          quantity: 2,
          addedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    useCartStore.getState().setQuantity('panel-1', 3);
    expect(useCartStore.getState().items[0]!.quantity).toBe(5);
  });

  it('clears every line', () => {
    useCartStore.getState().add(panel, 10);
    useCartStore.getState().add(cable, 10);
    useCartStore.getState().clear();

    expect(useCartStore.getState().items).toEqual([]);
    expect(calculateCartTotal(useCartStore.getState().items).totalGross).toBe(0);
  });
});
