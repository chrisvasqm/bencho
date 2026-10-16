import { cn } from './cn.ts';

export interface SpinnerProps {
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

/** Spinning ring in the current text color. Hidden from screen readers unless it has a label. */
export function Spinner({ size = 'sm', label, className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        size === 'sm' ? 'size-3.5' : 'size-5',
        className,
      )}
    />
  );
}
