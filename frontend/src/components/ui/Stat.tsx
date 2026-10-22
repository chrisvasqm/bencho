import { useId } from 'react';
import { Badge } from './Badge.tsx';
import { cn } from './cn.ts';

export type StatTone = 'neutral' | 'success' | 'danger';

export interface StatDetail {
  label: string;
  value: string;
  limit?: string;
  tone?: StatTone;
}

export interface StatProps {
  label: string;
  value: string;
  unit?: string;
  limit?: string;
  tone?: StatTone;
  /** Shown in a tooltip on hover or keyboard focus: one line per related number. */
  details?: StatDetail[];
  /** Badge text next to the label, e.g. "Within limit"; coloured by `tone`. */
  status?: string;
  /** How far the value is along its limit (1 = at the limit), with the text under the bar. */
  meter?: { ratio: number; label: string };
  testId?: string;
}

const toneClasses: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  danger: 'text-danger',
};

const barClasses: Record<StatTone, string> = {
  neutral: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
};

/** One measured number in a tile, with its unit and the limit it was judged against. */
export function Stat({
  label,
  value,
  unit,
  limit,
  tone = 'neutral',
  details,
  status,
  meter,
  testId,
}: StatProps) {
  const tooltipId = useId();
  const hasDetails = Boolean(details?.length);
  return (
    <div
      data-testid={testId}
      // Hovering, tapping or focusing the tile reveals the details; the tile is focusable only then.
      tabIndex={hasDetails ? 0 : undefined}
      role={hasDetails ? 'group' : undefined}
      aria-label={hasDetails ? label : undefined}
      aria-describedby={hasDetails ? tooltipId : undefined}
      className="group relative flex min-w-0 flex-col gap-2 rounded-md bg-surface-sunken px-4 py-3 outline-offset-[-2px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</span>
        {status && <Badge tone={tone}>{status}</Badge>}
      </div>
      <span className={cn('font-mono text-2xl font-semibold tabular-nums', toneClasses[tone])}>
        {value}
        {unit && <span className="ml-1.5 text-sm font-normal text-fg-muted">{unit}</span>}
      </span>
      {meter ? (
        <div className="flex flex-col gap-1">
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className={cn('h-full rounded-full transition-[width]', barClasses[tone])}
              style={{ width: `${Math.min(1, Math.max(0, meter.ratio)) * 100}%` }}
            />
          </div>
          <div className="flex justify-between gap-2 font-mono text-[11px] text-fg-muted">
            <span>{meter.label}</span>
            {limit && <span>limit {limit}</span>}
          </div>
        </div>
      ) : (
        limit && <span className="font-mono text-[11px] text-fg-muted">limit {limit}</span>
      )}
      {hasDetails && (
        <dl
          id={tooltipId}
          role="tooltip"
          data-testid={testId ? `${testId}-details` : undefined}
          className="pointer-events-none absolute top-full left-0 z-10 mt-1 grid w-max max-w-[calc(100vw-2rem)] grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-line bg-surface px-3 py-2 text-xs opacity-0 shadow-raised transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        >
          {details?.map((detail) => (
            <div key={detail.label} className="contents">
              <dt className="font-medium text-fg-muted">{detail.label}</dt>
              <dd className="m-0 font-mono tabular-nums">
                <span className={cn('font-semibold', toneClasses[detail.tone ?? 'neutral'])}>
                  {detail.value}
                </span>
                {detail.limit && <span className="ml-2 text-fg-muted">limit {detail.limit}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
