// Why a run passed or failed, in one sentence, from the totals it stored and the limits it ran
// with. Mirrors the k6 thresholds the backend sets (backend/k6/lib/options.ts).
import type { Run } from '../../api/runs.ts';
import type { Copy } from '../../i18n/useCopy.ts';
import { LATENCY_KEYS, formatMs, formatPercent, plannedRuns } from './format.ts';

/** k6 `checks: rate>0.99`: a run fails once 1 in 100 steps or more miss their check. */
const MIN_CHECK_RATE = 0.99;

/** The limits a finished run broke, each as "p95 1.24 s, limit 500 ms". */
export function brokenLimits(run: Run, t: Copy): string[] {
  const metrics = run.summary?.metrics;
  if (!metrics) return [];
  const broken: string[] = [];
  for (const [key, metricKey] of LATENCY_KEYS) {
    const value = metrics.http_req_duration?.[metricKey];
    const limit = run.limits.latencyLimitsMs[key];
    if (value !== undefined && value >= limit) {
      broken.push(t('verdict.latency', { key, value: formatMs(value), limit: formatMs(limit) }));
    }
  }
  const failed = metrics.http_req_failed?.value;
  if (failed !== undefined && failed >= run.limits.maxErrorRate) {
    broken.push(
      t('verdict.errors', {
        value: formatPercent(failed),
        limit: formatPercent(run.limits.maxErrorRate),
      }),
    );
  }
  const checks = metrics.checks?.value;
  if (checks !== undefined && checks <= MIN_CHECK_RATE) {
    broken.push(t('verdict.checks', { value: formatPercent(checks) }));
  }
  // Rate runs: `dropped_iterations: count<max(1, planned * maxErrorRate)`, like the backend.
  const dropped = metrics.dropped_iterations?.count ?? 0;
  const allowedDrops = Math.max(1, plannedRuns(run.stages) * run.limits.maxErrorRate);
  if (run.mode === 'rate' && dropped >= allowedDrops) {
    broken.push(t('verdict.dropped', { count: dropped }));
  }
  return broken;
}

/** One sentence under the status: the reason, or what to expect next. */
export function verdictReason(run: Run, t: Copy): string {
  switch (run.status) {
    case 'queued':
    case 'running':
      return t('detail.waiting');
    case 'stopped':
      return t('verdict.stopped');
    case 'error':
      return t('verdict.error');
    case 'failed': {
      const broken = brokenLimits(run, t);
      return broken.length > 0 ? broken.join(' · ') : t('verdict.failedUnknown');
    }
    case 'passed': {
      const p95 = run.summary?.metrics.http_req_duration?.['p(95)'];
      return p95 === undefined
        ? t('verdict.passedNoTotals')
        : t('verdict.passed', {
            p95: formatMs(p95),
            limit: formatMs(run.limits.latencyLimitsMs.p95),
          });
    }
  }
}
