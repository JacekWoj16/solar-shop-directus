import type { Product } from '@/types/product';

import { ProductRow } from './ProductRow';

/**
 * The product table — the core UI of the store.
 *
 * A table, not a grid of cards, and deliberately so: a buyer ordering forty
 * pallets wants forty rows on screen with an inline quantity field, not forty
 * cards to scroll past. Density is the feature.
 *
 * A server component: it renders the shell and hands each product to a client
 * row, so only the interactive part ships JavaScript. Below `md` the CSS in
 * `globals.css` reflows each row into a card without duplicating the markup —
 * two copies of the table would mean two copies of the quantity state, which
 * would then disagree across a resize.
 */
export function ProductTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-10 text-center">
        <p className="text-sm font-medium text-ink">No products match your filters.</p>
        <p className="mt-1 text-sm text-ink-muted">
          Try widening the price or power range, or clearing the in-stock filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table role="table" className="product-table w-full border-collapse text-left">
        <thead role="rowgroup">
          <tr role="row" className="border-b border-line-strong bg-table-head text-xs uppercase tracking-wider text-ink-muted">
            <th role="columnheader" scope="col" className="py-2.5 pr-4 font-medium">
              Product
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 text-right font-medium">
              Unit price
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 font-medium">
              Availability
            </th>
            <th role="columnheader" scope="col" className="py-2.5 pr-4 font-medium">
              Quantity
            </th>
            <th role="columnheader" scope="col" className="py-2.5 text-right font-medium">
              <span className="sr-only">Line total and add to cart</span>
            </th>
          </tr>
        </thead>

        <tbody role="rowgroup">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
