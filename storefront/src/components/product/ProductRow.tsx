'use client';

import Image from 'next/image';
import { useState } from 'react';

import { getQuantityRules } from '@/lib/cart';
import { formatNumber, formatPrice } from '@/lib/format';
import { getNextTierNudge, getUnitPrice, resolveTier } from '@/lib/pricing';
import { useCartStore } from '@/stores/cart.store';
import type { Product } from '@/types/product';

import { StockBadge } from '../shared/StockBadge';
import { QuantityInput } from './QuantityInput';
import { TierNudge } from './TierNudge';
import { VolumePricing } from './VolumePricing';

/**
 * One product in the table.
 *
 * This is where the shop's central promise is kept: the unit price recomputes
 * from the tier table as the quantity changes, before anything is added to a
 * cart and without a round-trip. The row owns its quantity; the cart only hears
 * about it when the buyer commits.
 */
export function ProductRow({ product }: { product: Product }) {
  const rules = getQuantityRules(product);

  const [quantity, setQuantity] = useState(rules.min);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const addToCart = useCartStore((state) => state.add);

  const unitPrice = getUnitPrice(product.price_tiers, quantity);
  const activeTier = resolveTier(product.price_tiers, quantity);
  const nudge = getNextTierNudge(product.price_tiers, quantity);

  const outOfStock = product.stock_status === 'out_of_stock';
  const quotable = unitPrice === null;
  const canOrder = !outOfStock && !quotable;

  function handleAdd() {
    if (!canOrder) return;
    addToCart(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <>
      <tr role="row" className="border-b border-line align-top transition-colors hover:bg-surface-sunken/60">
        <td role="cell" data-label="Product" className="py-3 pr-4">
          <div className="flex gap-3">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-md border border-line object-cover"
                sizes="64px"
              />
            ) : (
              <div className="size-16 shrink-0 rounded-md border border-line bg-surface-sunken" />
            )}

            <div className="min-w-0">
              {/* Long module names are the norm; clamping keeps rows uniform
                  while the title attribute preserves the full string. */}
              <p
                className="line-clamp-2 text-sm font-medium text-ink"
                title={product.name}
              >
                {product.name}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{product.brand}</p>
              <p className="mt-0.5 font-mono text-xs text-ink-subtle">{product.sku}</p>
              {product.power_watts ? (
                <p className="mt-0.5 text-xs text-ink-muted">
                  {formatNumber(product.power_watts, 0)} W
                </p>
              ) : null}
            </div>
          </div>
        </td>

        <td role="cell" data-label="Unit price" className="py-3 pr-4 text-right">
          {quotable ? (
            <span className="text-sm text-ink-muted">Contact for price</span>
          ) : (
            <>
              <span className="block text-sm font-semibold tabular-nums text-price">
                {formatPrice(unitPrice)}
              </span>
              <span className="block text-xs text-ink-subtle">net / unit</span>

              {product.price_tiers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setTiersOpen((open) => !open)}
                  aria-expanded={tiersOpen}
                  className="mt-1 text-xs font-medium text-brand underline-offset-2 hover:underline"
                >
                  {tiersOpen ? 'Hide' : `${product.price_tiers.length} price breaks`}
                </button>
              ) : null}
            </>
          )}
        </td>

        <td role="cell" data-label="Availability" className="py-3 pr-4">
          <StockBadge status={product.stock_status} />
        </td>

        <td role="cell" data-label="Quantity" className="py-3 pr-4">
          <QuantityInput
            value={quantity}
            onChange={setQuantity}
            rules={rules}
            disabled={!canOrder}
            label={`Quantity of ${product.name}`}
          />
        </td>

        <td role="cell" data-label="" className="py-3 text-right">
          {canOrder ? (
            <span className="block text-sm font-semibold tabular-nums text-ink">
              {formatPrice((unitPrice ?? 0) * quantity)}
            </span>
          ) : null}

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canOrder}
            className={`mt-1.5 w-full rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors sm:w-auto ${
              added ? 'bg-stock-in' : 'bg-accent hover:bg-accent-hover'
            } disabled:cursor-not-allowed disabled:bg-ink-subtle`}
          >
            {outOfStock ? 'Unavailable' : added ? 'Added' : quotable ? 'Enquire' : 'Add to cart'}
          </button>

          {nudge && canOrder ? (
            <div className="mt-1.5">
              <TierNudge nudge={nudge} onApply={setQuantity} />
            </div>
          ) : null}
        </td>
      </tr>

      {tiersOpen ? (
        <tr role="row" className="border-b border-line bg-surface-sunken/40">
          {/* An expanding sub-row rather than a floating popover: it can never be
              clipped by the table's scroll container and it reflows on mobile
              with no positioning logic at all. */}
          <td role="cell" colSpan={5} className="px-0 py-3 sm:pl-[4.75rem]">
            <VolumePricing
              tiers={product.price_tiers}
              quantity={quantity}
              onSelectQuantity={setQuantity}
            />
            {activeTier ? (
              <p className="mt-2 text-xs text-ink-muted">
                At {formatNumber(quantity, 0)} units you are on the{' '}
                {formatPrice(activeTier.unit_price)} bracket.
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
