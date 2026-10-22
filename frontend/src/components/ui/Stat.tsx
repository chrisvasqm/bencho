import { useId } from 'react';
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
  testId?: string;
}

const toneClasses: Record<StatTone, string> = {
  neutral: 'text-fg',
  success: 'text-success',
  danger: 'text-danger',
};

/** One measured number in a tile, with its unit and the limit it was judged against. */
export function Stat({ label, value, unit, limit, tone = 'neutral', details, testId }: StatProps) {
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
      className="group relative flex min-w-0 flex-col gap-0.5 rounded-md bg-surface-sunken px-3 py-2 outline-offset-[-2px]"
    >
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      <span className={cn('font-mono text-base font-semibold tabular-nums', toneClasses[tone])}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-fg-muted">{unit}</span>}
      </span>
      {limit && <span className="font-mono text-[11px] text-fg-muted">limit {limit}</span>}
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
