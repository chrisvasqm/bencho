import { Badge, Stat, type StatTone } from '../../components/ui/index.ts';
import type { Run } from '../../api/runs.ts';
import {
  STATUS_LABELS,
  STATUS_TONES,
  durationSeconds,
  formatMs,
  formatPercent,
  formatStages,
  isActive,
} from './format.ts';

export interface RunDetailProps {
  run: Run;
}

const PERCENTILE_KEYS = [
  ['p50', 'med'],
  ['p90', 'p(90)'],
  ['p95', 'p(95)'],
  ['p99', 'p(99)'],
] as const;

function toneFor(value: number | undefined, limit: number): StatTone {
  if (value === undefined) return 'neutral';
  return value < limit ? 'success' : 'danger';
}

export function RunDetail({ run }: RunDetailProps) {
  const duration = run.summary?.metrics.http_req_duration;
  const failed = run.summary?.metrics.http_req_failed;
  const requests = run.summary?.metrics.http_reqs;
  const elapsed = durationSeconds(run);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={STATUS_TONES[run.status]} pulse={isActive(run.status)}>
          {STATUS_LABELS[run.status]}
        </Badge>
        <span className="font-mono text-sm text-fg-muted">{run.baseUrl}</span>
        {elapsed !== undefined && (
          <span className="text-sm text-fg-faint">{elapsed.toFixed(0)} s</span>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-fg-muted">Load shape</dt>
        <dd className="font-mono text-xs">{formatStages(run.stages)}</dd>
        <dt className="text-fg-muted">Think time</dt>
        <dd className="font-mono text-xs">{run.limits.thinkTimeSeconds} s</dd>
      </dl>

      {run.summary ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {PERCENTILE_KEYS.map(([label, metricKey]) => (
            <Stat
              key={label}
              label={label}
              value={formatMs(duration?.[metricKey])}
              limit={`< ${run.limits.latencyLimitsMs[label]} ms`}
              tone={toneFor(duration?.[metricKey], run.limits.latencyLimitsMs[label])}
            />
          ))}
          <Stat
            label="Error rate"
            value={formatPercent(failed?.value)}
            limit={`< ${(run.limits.maxErrorRate * 100).toFixed(2)}%`}
            tone={toneFor(failed?.value, run.limits.maxErrorRate)}
          />
          <Stat
            label="Requests"
            value={requests ? String(requests.count) : '–'}
            unit={requests ? `${requests.rate.toFixed(1)}/s` : undefined}
          />
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          {isActive(run.status)
            ? 'Results appear when the run finishes.'
            : 'No results were recorded.'}
        </p>
      )}

      {run.errorMessage && (
        <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-xs text-danger">
          {run.errorMessage}
        </pre>
      )}
    </div>
  );
}
