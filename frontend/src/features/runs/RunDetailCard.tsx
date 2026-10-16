import { Suspense, lazy, useEffect, useState } from 'react';
import type { Run } from '../../api/runs.ts';
import { Badge, Button, Card, Skeleton, Stat, type StatTone } from '../../components/ui/index.ts';
import {
  RUN_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  durationSeconds,
  formatMs,
  formatPercent,
  formatStages,
  formatTime,
  isActive,
} from './format.ts';

export interface RunDetailCardProps {
  run: Run;
  onDelete: (run: Run) => void;
  deleting: boolean;
}

const PERCENTILE_KEYS = [
  ['p50', 'med'],
  ['p90', 'p(90)'],
  ['p95', 'p(95)'],
  ['p99', 'p(99)'],
] as const;

const CONFIRM_TIMEOUT_MS = 4000;

// Charts pull in recharts; load them after the first paint.
const RunCharts = lazy(() =>
  import('./RunCharts.tsx').then((module) => ({ default: module.RunCharts })),
);

function toneFor(value: number | undefined, limit: number): StatTone {
  if (value === undefined) return 'neutral';
  return value < limit ? 'success' : 'danger';
}

export function RunDetailCard({ run, onDelete, deleting }: RunDetailCardProps) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const duration = run.summary?.metrics.http_req_duration;
  const failed = run.summary?.metrics.http_req_failed;
  const requests = run.summary?.metrics.http_reqs;
  const elapsed = durationSeconds(run);
  const active = isActive(run.status);

  const deleteButton = active ? null : confirming ? (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Keep
      </Button>
      <Button variant="danger" size="sm" loading={deleting} onClick={() => onDelete(run)}>
        Delete run
      </Button>
    </div>
  ) : (
    <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  );

  return (
    <Card
      title={`${RUN_TYPE_LABELS[run.type]} run · ${formatTime(run.createdAt)}`}
      description={<span className="text-xs">{run.baseUrl}</span>}
      actions={deleteButton}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Badge tone={STATUS_TONES[run.status]} pulse={active}>
            {STATUS_LABELS[run.status]}
          </Badge>
          <span className="text-xs text-fg-muted">{formatStages(run.stages)}</span>
          <span className="text-xs text-fg-muted">think time {run.limits.thinkTimeSeconds}s</span>
          {elapsed !== undefined && (
            <span className="text-xs text-fg-faint">took {elapsed.toFixed(0)}s</span>
          )}
        </div>

        {run.summary ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6">
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
            {active
              ? 'Totals appear when the run finishes. The charts below update every 2 seconds.'
              : 'No totals were recorded.'}
          </p>
        )}

        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <RunCharts run={run} />
        </Suspense>

        {run.errorMessage && (
          <pre className="m-0 overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap text-danger">
            {run.errorMessage}
          </pre>
        )}
      </div>
    </Card>
  );
}
