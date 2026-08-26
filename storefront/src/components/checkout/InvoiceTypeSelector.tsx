'use client';

import type { InvoiceType } from '@/types/order';

const OPTIONS: Array<{ value: InvoiceType; label: string; description: string }> = [
  {
    value: 'anonymous',
    label: 'Anonymous invoice',
    description:
      'Faktura bezimienna — no buyer details on the document. Suitable for smaller purchases.',
  },
  {
    value: 'nip',
    label: 'Company invoice (NIP)',
    description:
      'Issued to your company with its tax ID, so the purchase can be deducted.',
  },
];

/**
 * Invoice type.
 *
 * Two large targets rather than a dropdown: this choice changes which fields
 * the rest of the form asks for, so it should be visibly a fork in the road
 * rather than a setting tucked into a select.
 */
export function InvoiceTypeSelector({
  value,
  onChange,
}: {
  value: InvoiceType;
  onChange: (value: InvoiceType) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Invoice type</legend>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.value}
              className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                selected
                  ? 'border-brand bg-brand-soft/40 ring-1 ring-brand'
                  : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="invoice-type"
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange(option.value)}
                  className="size-4 text-brand focus:ring-brand"
                />
                <span className="text-sm font-medium text-ink">{option.label}</span>
              </span>
              <span className="mt-1.5 block pl-6 text-xs text-ink-muted">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
