import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export type BadgeTone =
  'neutral' | 'accent' | 'highlight' | 'success' | 'danger' | 'warning' | 'info';

export interface BadgeProps {
  tone?: BadgeTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-fg-muted',
  accent: 'bg-accent-soft text-accent-strong',
  highlight: 'bg-highlight-soft text-highlight-strong',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
};

export function Badge({ tone = 'neutral', pulse, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
    >
      {pulse && (
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
