'use client';

import { formatPrice, formatTierRange } from '@/lib/format';
import { resolveTier, sortTiers } from '@/lib/pricing';
import type { PriceTier } from '@/types/product';

interface VolumePricingProps {
  tiers: PriceTier[];
  /** The quantity currently entered, used to highlight the active bracket. */
  quantity: number;
  /** Applies a bracket's starting quantity when the buyer clicks its row. */
  onSelectQuantity?: (quantity: number) => void;
}

/**
 * The volume pricing breakdown.
 *
 * Published openly rather than hidden behind "call for a quote": the whole
 * premise of the shop is that the price at your quantity is knowable before you
 * commit to it. Each bracket is clickable, so seeing a better price and taking
 * it is one action rather than a mental arithmetic problem.
 */
export function VolumePricing({
  tiers,
  quantity,
  onSelectQuantity,
}: VolumePricingProps) {
  const sorted = sortTiers(tiers);
  const active = resolveTier(sorted, quantity);
  const entryPrice = sorted[0]?.unit_price ?? 0;

  if (sorted.length === 0) return null;

  return (
    <table className="w-full max-w-xs border-collapse text-xs">
      <caption className="mb-1.5 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted">
        Volume pricing
      </caption>
      <thead>
        <tr className="border-b border-line text-ink-muted">
          <th scope="col" className="py-1 pr-3 text-left font-medium">
            Quantity
          </th>
          <th scope="col" className="py-1 pr-3 text-right font-medium">
            Unit price
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            Save
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((tier) => {
          const isActive = active?.id === tier.id;
          const saving =
            entryPrice > 0
              ? Math.round(((entryPrice - tier.unit_price) / entryPrice) * 100)
              : 0;

          const cells = (
            <>
              <td className="py-1 pr-3 tabular-nums">
                {formatTierRange(tier.min_quantity, tier.max_quantity)}
              </td>
              <td className="py-1 pr-3 text-right font-semibold tabular-nums text-price">
                {formatPrice(tier.unit_price)}
              </td>
              <td className="py-1 text-right tabular-nums text-ink-muted">
                {saving > 0 ? `−${saving}%` : '—'}
              </td>
            </>
          );

          if (!onSelectQuantity) {
            return (
              <tr
                key={tier.id}
                className={isActive ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted'}
              >
                {cells}
              </tr>
            );
          }

          return (
            <tr
              key={tier.id}
              onClick={() => onSelectQuantity(tier.min_quantity)}
              className={`cursor-pointer transition-colors hover:bg-surface-sunken ${
                isActive ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted'
              }`}
            >
              {cells}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
