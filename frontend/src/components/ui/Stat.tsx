import { cn } from './cn.ts';

export type StatTone = 'neutral' | 'success' | 'danger';

export interface StatProps {
  label: string;
  value: string;
  unit?: string;
  limit?: string;
  tone?: StatTone;
}

const toneClasses: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  danger: 'text-danger',
};

/** One measured number with its unit and the limit it was judged against. */
export function Stat({ label, value, unit, limit, tone = 'neutral' }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className={cn('text-xl font-semibold tabular-nums', toneClasses[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-normal text-fg-muted">{unit}</span>}
      </span>
      {limit && <span className="text-xs text-fg-faint">limit {limit}</span>}
    </div>
  );
}
