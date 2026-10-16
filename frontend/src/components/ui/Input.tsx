import type { InputHTMLAttributes } from 'react';
import { cn } from './cn.ts';
import { Spinner } from './Spinner.tsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
  /** Shows a spinner inside the field and marks it busy, e.g. while its value is being checked. */
  loading?: boolean;
}

export const inputClasses =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-faint ' +
  'hover:border-line-strong focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted';

export function Input({ invalid, mono, loading, className, ...rest }: InputProps) {
  const input = (
    <input
      aria-invalid={invalid || undefined}
      aria-busy={loading || undefined}
      className={cn(
        inputClasses,
        mono && 'tabular-nums',
        invalid && 'border-danger focus:border-danger',
        loading && 'pr-9',
        className,
      )}
      {...rest}
    />
  );
  if (!loading) return input;
  return (
    <div className="relative">
      {input}
      <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}
