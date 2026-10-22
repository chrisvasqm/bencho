import { Suspense, lazy, useEffect, useState } from 'react';
import type { Run } from '../../api/runs.ts';
import { Badge, Button, Card, Skeleton, Stat, type StatTone } from '../../components/ui/index.ts';
import { LearnMore } from '../learn/LearnMore.tsx';
import { useCopy } from '../../i18n/useCopy.ts';
import {
  STATUS_TONES,
  durationSeconds,
  formatMs,
  formatPercent,
  formatStages,
  formatTime,
  isActive,
  runTypeVars,
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
  const { t, language } = useCopy();
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
    ? {
        label: t('detail.stop'),
        confirm: t('detail.stopConfirm'),
        busy: stopping,
        run: () => onStop(run),
      }
    : {
        label: t('detail.delete'),
        confirm: t('detail.deleteConfirm'),
        busy: deleting,
        run: () => onDelete(run),
      };
  const actionButtons = confirming ? (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
        data-testid="run-action-keep"
      >
        {t('detail.keep')}
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
      title={t('detail.title', {
        ...runTypeVars(run.type, t),
        time: formatTime(run.createdAt, language),
      })}
      description={<span className="text-xs">{run.baseUrl}</span>}
      actions={actionButtons}
      data-testid="run-detail"
      data-run-id={run.id}
      data-status={run.status}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Badge tone={STATUS_TONES[run.status]} pulse={active}>
            {t(`status.${run.status}`)}
          </Badge>
          <span className="text-xs text-fg-muted">{formatStages(run.stages, run.mode, t)}</span>
          {run.mode === 'rate' && (
            <span className="text-xs text-fg-muted" data-testid="run-rate-cap">
              {t('detail.rateCap', { count: run.maxVirtualUsers })}
              {dropped > 0 && (
                <span className="text-warning" data-testid="run-dropped">
                  {' · '}
                  {t('detail.dropped', { count: dropped })}
                </span>
              )}
            </span>
          )}
          <span className="text-xs text-fg-muted">
            {t('detail.steps', { count: run.flow.length })}:{' '}
            {run.flow.map((step) => step.name).join(' → ')}
          </span>
          <span className="text-xs text-fg-muted">
            {t('detail.pauses', {
              think: run.limits.thinkTimeSeconds,
              grace: run.limits.gracePeriodSeconds,
            })}
            {run.flow.some((step) => step.wait) && t('detail.ownWaits')}
          </span>
          {elapsed !== undefined && (
            <span className="text-xs text-fg-faint">
              {t('detail.took', { seconds: elapsed.toFixed(0) })}
            </span>
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
              label={t('detail.errorRate')}
              value={formatPercent(failed?.value)}
              limit={`< ${(run.limits.maxErrorRate * 100).toFixed(2)}%`}
              tone={toneFor(failed?.value, run.limits.maxErrorRate)}
            />
            <Stat
              label={t('detail.requests')}
              value={requests ? String(requests.count) : '–'}
              unit={requests ? `${requests.rate.toFixed(1)}/s` : undefined}
            />
            <LearnMore
              testId="learn-results"
              className="col-span-full"
              title={t('detail.readTitle')}
              paragraphs={[
                t('detail.read1'),
                t('explain.percentile'),
                t('panel.percentileNote2'),
                t('detail.read2'),
                t('explain.failRule'),
                t('explain.failChecks'),
                ...(run.mode === 'rate' ? [t('explain.failRate')] : []),
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            {active ? t('detail.waiting') : t('detail.noTotals')}
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
  const { t } = useCopy();
  return (
    <section className="flex flex-col gap-3" data-testid="run-failures">
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-sm font-medium text-fg">{t('failures.title')}</h3>
        <p className="m-0 text-xs text-fg-muted">{t('failures.hint')}</p>
        <LearnMore
          testId="learn-failures"
          title={t('failures.learnTitle')}
          paragraphs={[t('failures.how'), t('failures.private')]}
        />
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
                    ? t('failures.extract', { status: failure.status })
                    : failure.status === 0
                      ? t('failures.network')
                      : expected === undefined
                        ? t('failures.status', { status: failure.status })
                        : t('failures.statusExpected', { status: failure.status, expected })}
                </span>
              </p>
              <pre className="m-0 max-h-40 overflow-auto rounded-md bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap break-all text-fg-muted">
                {failure.body || t('failures.emptyBody')}
              </pre>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
