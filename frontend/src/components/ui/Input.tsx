import type { InputHTMLAttributes } from 'react';
import { cn } from './cn.ts';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export const inputClasses =
  'h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-faint ' +
  'hover:border-line-strong focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-muted';

export function Input({ invalid, mono, className, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses,
        mono && 'font-mono tabular-nums',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...rest}
    />
  );
}
