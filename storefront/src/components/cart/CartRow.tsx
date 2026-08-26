'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { QuantityInput } from '@/components/product/QuantityInput';
import { TierNudge } from '@/components/product/TierNudge';
import { rulesFromCartItem } from '@/lib/cart';
import { formatNumber, formatPrice, formatTierRange } from '@/lib/format';
import { useCartStore } from '@/stores/cart.store';
import type { CartLine } from '@/types/cart';

/**
 * One line of the cart.
 *
 * Everything it needs was snapshotted when the product was added — name, SKU,
 * image, tiers, and the category's quantity rules — so the cart renders and
 * reprices itself with no network request at all, including on a cold reload.
 */
export function CartRow({ line }: { line: CartLine }) {
  const { item, unitPrice, lineTotal, activeTier, nudge } = line;

  const setQuantity = useCartStore((state) => state.setQuantity);
  const remove = useCartStore((state) => state.remove);

  const [confirmingRemove, setConfirmingRemove] = useState(false);

  return (
    <tr role="row" className="border-b border-line align-top">
      <td role="cell" data-label="Product" className="py-4 pr-4">
        <div className="flex gap-3">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-md border border-line object-cover"
              sizes="56px"
            />
          ) : (
            <div className="size-14 shrink-0 rounded-md border border-line bg-surface-sunken" />
          )}

          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium text-ink" title={item.name}>
              {item.name}
            </p>
            <p className="mt-0.5 font-mono text-xs text-ink-subtle">{item.sku}</p>
            <Link
              href={`/products/${item.categorySlug}`}
              className="mt-0.5 inline-block text-xs text-ink-muted transition-colors hover:text-brand"
            >
              {item.categoryName}
            </Link>
          </div>
        </div>
      </td>

      <td role="cell" data-label="Unit price" className="py-4 pr-4 text-right">
        <span className="block text-sm font-semibold tabular-nums text-price">
          {formatPrice(unitPrice)}
        </span>
        {/* Naming the active bracket is what makes a changing unit price read as
            a volume discount rather than as the shop moving its prices around. */}
        {activeTier ? (
          <span className="block text-xs text-ink-subtle">
            bracket {formatTierRange(activeTier.min_quantity, activeTier.max_quantity)}
          </span>
        ) : null}
      </td>

      <td role="cell" data-label="Quantity" className="py-4 pr-4">
        <QuantityInput
          value={item.quantity}
          onChange={(quantity) => setQuantity(item.productId, quantity)}
          rules={rulesFromCartItem(item)}
          label={`Quantity of ${item.name}`}
        />
        {item.minQuantity > 1 || item.quantityStep > 1 ? (
          <p className="mt-1 text-[0.6875rem] leading-tight text-ink-subtle">
            {item.minQuantity > 1 ? `min. ${formatNumber(item.minQuantity, 0)}` : null}
            {item.minQuantity > 1 && item.quantityStep > 1 ? ' · ' : null}
            {item.quantityStep > 1 ? `steps of ${formatNumber(item.quantityStep, 0)}` : null}
          </p>
        ) : null}
      </td>

      <td role="cell" data-label="Line total" className="py-4 pr-4 text-right">
        <span className="text-sm font-semibold tabular-nums text-ink">
          {formatPrice(lineTotal)}
        </span>

        {nudge ? (
          <div className="mt-2 max-w-xs sm:ml-auto">
            <TierNudge
              nudge={nudge}
              variant="line"
              onApply={(quantity) => setQuantity(item.productId, quantity)}
            />
          </div>
        ) : null}
      </td>

      <td role="cell" data-label="" className="py-4 text-right">
        {/* Confirmed inline rather than through a dialog: removing a line from a
            forty-line order is a mistake worth catching, but not one worth
            interrupting the page for. */}
        {confirmingRemove ? (
          <span className="inline-flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => remove(item.productId)}
              className="font-semibold text-stock-out underline-offset-2 hover:underline"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRemove(false)}
              className="text-ink-muted underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingRemove(true)}
            aria-label={`Remove ${item.name} from cart`}
            className="rounded-md p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-stock-out"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="size-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
              />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}
