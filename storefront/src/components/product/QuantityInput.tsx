'use client';

import { useId, useState } from 'react';

import {
  adjustQuantity,
  decrementQuantity,
  incrementQuantity,
  normalizeQuantity,
} from '@/lib/cart';
import { formatNumber } from '@/lib/format';
import type { QuantityRules } from '@/types/product';

interface QuantityInputProps {
  value: number;
  onChange: (quantity: number) => void;
  rules: QuantityRules;
  /** Announced to screen readers in place of a visible label. */
  label?: string;
  disabled?: boolean;
}

/**
 * Quantity field enforcing a category's minimum and step.
 *
 * The important detail is *when* the rules are applied. Normalising on every
 * keystroke makes the field unusable — typing "10" into a field with a minimum
 * of 5 would snap to 5 the instant "1" is entered, and the second digit never
 * lands. So the raw text is held while the buyer types and the rules are
 * applied on commit (blur or Enter), with a short note when the value had to
 * move. The −/+ buttons commit immediately, since they cannot produce an
 * invalid value in the first place.
 */
export function QuantityInput({
  value,
  onChange,
  rules,
  label = 'Quantity',
  disabled = false,
}: QuantityInputProps) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(value));
  const [notice, setNotice] = useState<string | null>(null);

  // Follow the committed value when it changes elsewhere (the +/− buttons, a
  // nudge being applied, or the cart being edited on another surface).
  //
  // Adjusted during render rather than in an effect: React re-runs this
  // component immediately with the new state, before the browser paints, so the
  // field never flashes the stale value. An effect would repaint twice and is
  // what `react-hooks/set-state-in-effect` warns about.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  function commit(raw: string) {
    const parsed = Number.parseInt(raw, 10);

    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      setNotice(null);
      return;
    }

    const adjustment = adjustQuantity(parsed, rules);
    const next =
      adjustment.kind === 'removed' ? rules.min : normalizeQuantity(parsed, rules);

    setDraft(String(next));

    if (adjustment.kind === 'raised_to_minimum' || adjustment.kind === 'removed') {
      setNotice(`Minimum ${formatNumber(rules.min, 0)}`);
    } else if (adjustment.kind === 'snapped_to_step') {
      setNotice(`Sold in steps of ${formatNumber(rules.step, 0)}`);
    } else {
      setNotice(null);
    }

    if (next !== value) onChange(next);
  }

  function step(direction: 1 | -1) {
    const next =
      direction === 1
        ? incrementQuantity(value, rules)
        : decrementQuantity(value, rules);

    setNotice(next === value && direction === -1 ? `Minimum ${formatNumber(rules.min, 0)}` : null);
    if (next !== value) onChange(next);
  }

  const atMinimum = value <= rules.min;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-stretch rounded-md border border-line bg-surface">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={disabled || atMinimum}
          aria-label="Decrease quantity"
          className="px-2.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>

        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          value={draft}
          min={rules.min}
          step={rules.step}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
          className="no-spinner w-14 border-x border-line py-1.5 text-center text-sm font-medium text-ink focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand disabled:bg-surface-sunken"
        />

        <button
          type="button"
          onClick={() => step(1)}
          disabled={disabled}
          aria-label="Increase quantity"
          className="px-2.5 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      {notice ? (
        <span role="status" className="text-[0.6875rem] leading-tight text-stock-low">
          {notice}
        </span>
      ) : null}
    </div>
  );
}
