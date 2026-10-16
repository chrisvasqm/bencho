import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  /** Test id of the error message; defaults to `${htmlFor}-error`. */
  errorTestId?: string;
}

/** Label, control, hint and error in one stack. Controls get their id from htmlFor. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
  errorTestId = `${htmlFor}-error`,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" data-testid={errorTestId} className="text-xs text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-fg-muted">{hint}</p>
      )}
    </div>
  );
}
