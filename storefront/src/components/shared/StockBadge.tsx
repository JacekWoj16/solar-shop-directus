import type { StockStatus } from '@/types/product';

/**
 * Availability indicator.
 *
 * The shop quotes a status, not a unit count — what a buyer needs to know is
 * whether a pallet can ship this week, and an exact figure would only ever be
 * stale by the time the page is served.
 */
const PRESENTATION: Record<StockStatus, { label: string; dot: string; text: string }> = {
  in_stock: { label: 'In stock', dot: 'bg-stock-in', text: 'text-stock-in' },
  low_stock: { label: 'Low stock', dot: 'bg-stock-low', text: 'text-stock-low' },
  out_of_stock: { label: 'Out of stock', dot: 'bg-stock-out', text: 'text-stock-out' },
};

export function StockBadge({ status }: { status: StockStatus }) {
  const { label, dot, text } = PRESENTATION[status];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium ${text}`}>
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
