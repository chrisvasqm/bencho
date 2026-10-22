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

/** One measured number in a tile, with its unit and the limit it was judged against. */
export function Stat({ label, value, unit, limit, tone = 'neutral' }: StatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-sunken px-3 py-2">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <span className={cn('font-mono text-base font-semibold tabular-nums', toneClasses[tone])}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-fg-muted">{unit}</span>}
      </span>
      {limit && <span className="font-mono text-[11px] text-fg-muted">limit {limit}</span>}
    </div>
  );
}
