'use client';

import { formatNumber, formatPrice } from '@/lib/format';
import type { TierNudge as TierNudgeData } from '@/types/product';

interface TierNudgeProps {
  nudge: TierNudgeData;
  /** Raises the quantity to the bracket. */
  onApply?: (quantity: number) => void;
  /** `line` adds the saving across the whole order line. */
  variant?: 'compact' | 'line';
}

/**
 * "Add N more and pay less per unit."
 *
 * Shown only when the next bracket is genuinely close and genuinely cheaper —
 * `getNextTierNudge` decides that, not this component. Prompting on every row
 * would train buyers to ignore it.
 */
export function TierNudge({ nudge, onApply, variant = 'compact' }: TierNudgeProps) {
  const { unitsNeeded, targetQuantity, savingPercent, savingPerUnit } = nudge;
  const units = unitsNeeded === 1 ? 'unit' : 'units';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-nudge-surface px-2.5 py-1.5 text-xs text-ink">
      <span className="font-medium">
        Add {formatNumber(unitsNeeded, 0)} more {units} → −{formatNumber(savingPercent, 1)}%
      </span>

      {variant === 'line' ? (
        <span className="text-ink-muted">
          saves {formatPrice(savingPerUnit)}/unit
        </span>
      ) : null}

      {onApply ? (
        <button
          type="button"
          onClick={() => onApply(targetQuantity)}
          className="ml-auto font-semibold text-brand underline-offset-2 hover:underline"
        >
          Add them
        </button>
      ) : null}
    </div>
  );
}
