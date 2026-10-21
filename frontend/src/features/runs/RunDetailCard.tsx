import { Suspense, lazy, useEffect, useState } from 'react';
import type { Run } from '../../api/runs.ts';
import {
  Badge,
  Button,
  Card,
  Note,
  Skeleton,
  Stat,
  type StatTone,
} from '../../components/ui/index.ts';
import {
  EXPLAIN,
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
  onStop: (run: Run) => void;
  stopping: boolean;
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

export function RunDetailCard({ run, onDelete, deleting, onStop, stopping }: RunDetailCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingFor, setConfirmingFor] = useState(run.status);
  if (confirmingFor !== run.status) {
    setConfirmingFor(run.status);
    setConfirming(false);
  }
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const duration = run.summary?.metrics.http_req_duration;
  const failed = run.summary?.metrics.http_req_failed;
  const requests = run.summary?.metrics.http_reqs;
  const dropped = run.summary?.metrics.dropped_iterations?.count ?? 0;
  const elapsed = durationSeconds(run);
  const active = isActive(run.status);

  // Same two-step confirm for both: stop while active, delete once finished.
  const action = active
    ? { label: 'Stop', confirm: 'Stop run', busy: stopping, run: () => onStop(run) }
    : { label: 'Delete', confirm: 'Delete run', busy: deleting, run: () => onDelete(run) };
  const actionButtons = confirming ? (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        data-testid="run-action-keep"
      >
        Keep
      </Button>
      <Button
        variant="danger"
        size="sm"
        loading={action.busy}
        onClick={action.run}
        data-testid="run-action-confirm"
      >
        {action.confirm}
      </Button>
    </div>
  ) : (
    <Button
      variant={active ? 'danger' : 'ghost'}
      size="sm"
      onClick={() => setConfirming(true)}
      data-testid={active ? 'run-stop' : 'run-delete'}
    >
      {action.label}
    </Button>
  );

  return (
    <Card
      title={`${RUN_TYPE_LABELS[run.type]} run · ${formatTime(run.createdAt)}`}
      description={<span className="text-xs">{run.baseUrl}</span>}
      actions={actionButtons}
      data-testid="run-detail"
      data-run-id={run.id}
      data-status={run.status}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Badge tone={STATUS_TONES[run.status]} pulse={active}>
            {STATUS_LABELS[run.status]}
          </Badge>
          <span className="text-xs text-fg-muted">{formatStages(run.stages, run.mode)}</span>
          {run.mode === 'rate' && (
            <span className="text-xs text-fg-muted" data-testid="run-rate-cap">
              rate, up to {run.maxVirtualUsers} VUs
              {dropped > 0 && (
                <span className="text-warning" data-testid="run-dropped">
                  {' '}
                  · {dropped} flow {dropped === 1 ? 'run' : 'runs'} dropped (all VUs busy)
                </span>
              )}
            </span>
          )}
          <span className="text-xs text-fg-muted">
            {run.flow.length === 1 ? '1 step' : `${run.flow.length} steps`}:{' '}
            {run.flow.map((step) => step.name).join(' → ')}
          </span>
          <span className="text-xs text-fg-muted">
            think time {run.limits.thinkTimeSeconds}s
            {run.flow.some((step) => step.wait) && ', some steps wait their own range'}
          </span>
          {elapsed !== undefined && (
            <span className="text-xs text-fg-faint">took {elapsed.toFixed(0)}s</span>
          )}
        </div>

        {run.summary ? (
          <div
            data-testid="run-summary"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-6"
          >
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
            <Note title="How to read these numbers" className="col-span-full">
              <p className="m-0">
                Green means below its limit, red means it reached the limit. p50, p90, p95 and p99:{' '}
                {EXPLAIN.percentile}
              </p>
              <p className="m-0">
                {EXPLAIN.errorRate} Requests is the total sent, with the average per second.
              </p>
              <p className="m-0">{EXPLAIN.failRule}</p>
            </Note>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            {active
              ? 'Totals appear when the run finishes. The charts below update every 2 seconds.'
              : 'No totals were recorded.'}
          </p>
        )}

        {run.failures.length > 0 && <FailureList run={run} />}

        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <RunCharts run={run} />
        </Suspense>

        {run.errorMessage && (
          <pre
            data-testid="run-error-message"
            className="m-0 overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap text-danger"
          >
            {run.errorMessage}
          </pre>
        )}
      </div>
    </Card>
  );
}

/** Sampled failed responses: what the target answered when a step failed. */
function FailureList({ run }: { run: Run }) {
  return (
    <section className="flex flex-col gap-3" data-testid="run-failures">
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-medium text-fg">Failed responses (sample)</h3>
        <p className="m-0 text-xs text-fg-muted">
          Bodies are read in 1 of every 20 flow runs, so these are examples, not every failure. A
          success response (2xx) shows its JSON keys only, since it may hold tokens. Each step shows
          up to 10 different responses, at most 3 per status.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {run.failures.map((failure, index) => {
          const expected = run.flow.find((step) => step.name === failure.step)?.expectedStatus;
          return (
            <li
              // A run's failures never change once stored, so the position is a stable key.
              key={index}
              className="flex flex-col gap-1.5"
              data-testid="run-failure"
            >
              <p className="m-0 text-xs text-fg">
                <span className="font-medium">{failure.step}</span>
                <span className="text-fg-muted">
                  {' · '}
                  {failure.reason === 'extract'
                    ? `status ${failure.status}, a value to save was missing (body shows its keys only)`
                    : failure.status === 0
                      ? 'no response (network error)'
                      : `status ${failure.status}${expected === undefined ? '' : `, expected ${expected}`}`}
                </span>
              </p>
              <pre className="m-0 max-h-40 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap break-all text-fg-muted">
                {failure.body || '(empty body)'}
              </pre>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
