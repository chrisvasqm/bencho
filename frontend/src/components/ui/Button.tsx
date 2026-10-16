import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn.ts';
import { Spinner } from './Spinner.tsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'block';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-surface-sunken text-fg hover:bg-line',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-sunken hover:text-fg',
  danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-surface',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-md px-3 text-sm active:scale-[0.98]',
  md: 'h-10 rounded-md px-4 text-sm active:scale-[0.98]',
  // Fills a flush card footer edge to edge; rounded like the card's bottom corners. No scale on
  // press (it would show gaps at the edges), and the focus ring sits inside: outside it would
  // cover the card body. `!` beats the unlayered global :focus-visible rule.
  block:
    'min-h-14 w-full rounded-b-lg px-5 text-base active:brightness-90 focus-visible:-outline-offset-4! focus-visible:outline-accent-fg!',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
