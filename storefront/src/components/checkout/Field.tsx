'use client';

import { useId } from 'react';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Shown under the label; use for the reason a field is needed. */
  hint?: string;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
}

/**
 * A labelled text input with its error message.
 *
 * Errors are wired with `aria-describedby` and `aria-invalid` rather than left
 * as red text: a form that only signals failure by colour is unusable to anyone
 * relying on a screen reader, and this one is the last step before money moves.
 */
export function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  autoComplete,
  placeholder,
  multiline = false,
  optional = false,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  const className = `mt-1 w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:outline-none ${
    error
      ? 'border-stock-out focus:border-stock-out'
      : 'border-line focus:border-brand'
  }`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-ink-subtle">(optional)</span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}

      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-stock-out">
          {error}
        </p>
      ) : null}
    </div>
  );
}
