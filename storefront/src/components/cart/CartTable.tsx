'use client';

import type { CartLine } from '@/types/cart';

import { CartRow } from './CartRow';

/**
 * The cart as a full-page table, not a slide-over panel.
 *
 * A B2B order runs to dozens of lines with per-line quantity rules and volume
 * brackets to check; that does not fit in a drawer, and a buyer about to commit
 * five figures wants to see the whole thing at once.
 */
export function CartTable({ lines }: { lines: CartLine[] }) {
  return (
    <div className="overflow-x-auto">
      <table role="table" className="reflow-table w-full border-collapse text-left">
        <thead role="rowgroup">
          <tr
            role="row"
            className="border-b border-line-strong bg-table-head text-xs uppercase tracking-wider text-ink-muted"
          >
            <th role="columnheader" scope="col" className="py-2.5 pr-4 font-medium">
              Product
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 text-right font-medium">
              Unit price
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 font-medium">
              Quantity
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 text-right font-medium">
              Line total
            </th>
            <th role="columnheader" scope="col" className="py-2.5 text-right font-medium">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>

        <tbody role="rowgroup">
          {lines.map((line) => (
            <CartRow key={line.item.productId} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
