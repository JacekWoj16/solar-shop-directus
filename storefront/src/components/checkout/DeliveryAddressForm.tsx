'use client';

import { formatPostalCode } from '@/lib/format';
import type { CheckoutErrors, CheckoutInput } from '@/lib/checkout';

import { Field } from './Field';

/** Delivery details. Always required, whichever invoice type is chosen. */
export function DeliveryAddressForm({
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
        label="Recipient name"
        value={values.deliveryName}
        onChange={(value) => onChange('deliveryName', value)}
        error={errors.deliveryName}
        autoComplete="name"
      />

      <Field
        label="Street and building number"
        value={values.deliveryAddress}
        onChange={(value) => onChange('deliveryAddress', value)}
        error={errors.deliveryAddress}
        autoComplete="street-address"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field
          label="Postal code"
          value={values.deliveryPostalCode}
          // Punctuated as it is typed: the dash is positional, so inserting it
          // helps rather than fights, unlike the NIP grouping.
          onChange={(value) => onChange('deliveryPostalCode', formatPostalCode(value))}
          error={errors.deliveryPostalCode}
          placeholder="00-001"
          autoComplete="postal-code"
        />

        <Field
          label="City"
          value={values.deliveryCity}
          onChange={(value) => onChange('deliveryCity', value)}
          error={errors.deliveryCity}
          autoComplete="address-level2"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Phone"
          type="tel"
          value={values.deliveryPhone}
          onChange={(value) => onChange('deliveryPhone', value)}
          error={errors.deliveryPhone}
          hint="Couriers call before delivering a pallet."
          autoComplete="tel"
        />

        <Field
          label="Email"
          type="email"
          value={values.deliveryEmail}
          onChange={(value) => onChange('deliveryEmail', value)}
          error={errors.deliveryEmail}
          hint="Where the proforma invoice is sent."
          autoComplete="email"
        />
      </div>

      <Field
        label="Order notes"
        value={values.notes}
        onChange={(value) => onChange('notes', value)}
        multiline
        optional
        placeholder="Delivery constraints, loading equipment, preferred hours…"
      />
    </div>
  );
}
