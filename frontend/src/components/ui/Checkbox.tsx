import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import { cn } from './cn.ts';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Some, not all, of a group are checked (select-all headers). */
  indeterminate?: boolean;
}

export function Checkbox({ indeterminate = false, className, ...rest }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded-sm accent-accent-line disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...rest}
    />
  );
}
