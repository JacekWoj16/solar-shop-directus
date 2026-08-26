'use client';

import { formatNip } from '@/lib/nip';
import type { CheckoutErrors, CheckoutInput } from '@/lib/checkout';

import { Field } from './Field';

/** Company details, shown only when a NIP invoice is chosen. */
export function CompanyDetailsForm({
  values,
  errors,
  onChange,
}: {
  values: CheckoutInput;
  errors: CheckoutErrors;
  onChange: <K extends keyof CheckoutInput>(field: K, value: CheckoutInput[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Field
        label="Company name"
        value={values.companyName}
        onChange={(value) => onChange('companyName', value)}
        error={errors.companyName}
        autoComplete="organization"
      />

      <Field
        label="NIP"
        value={values.nip}
        // Grouped on blur rather than as they type: reformatting mid-entry
        // fights the caret and makes correcting a digit unpleasant.
        onChange={(value) => onChange('nip', value)}
        error={errors.nip}
        hint="Ten digits. The checksum is verified before the order is placed."
        placeholder="123-456-32-18"
        autoComplete="off"
      />

      <div className="-mt-2">
        <button
          type="button"
          onClick={() => onChange('nip', formatNip(values.nip))}
          className="text-xs text-brand underline-offset-2 hover:underline"
        >
          Format NIP
        </button>
      </div>

      <Field
        label="Company address"
        value={values.companyAddress}
        onChange={(value) => onChange('companyAddress', value)}
        error={errors.companyAddress}
        multiline
        placeholder={'ul. Przykładowa 1\n00-001 Warszawa'}
        autoComplete="street-address"
      />
    </div>
  );
}
