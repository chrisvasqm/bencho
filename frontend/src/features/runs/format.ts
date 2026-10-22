import type { BadgeTone } from '../../components/ui/index.ts';
import type { LoadMode, Run, RunStatus, RunType, Stage } from '../../api/runs.ts';

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  load: 'Load',
  stress: 'Stress',
  spike: 'Spike',
};

export const RUN_TYPE_DESCRIPTIONS: Record<RunType, string> = {
  load: 'Steady, expected traffic. Confirms the API meets its limits on a normal day.',
  stress: 'Steps up past normal traffic to find where latency or errors start to climb.',
  spike: 'Jumps to a burst of users in seconds, then drops back to check recovery.',
};

export const STATUS_LABELS: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  error: 'Error',
  stopped: 'Stopped',
};

export const STATUS_TONES: Record<RunStatus, BadgeTone> = {
  queued: 'neutral',
  running: 'info',
  passed: 'success',
  failed: 'danger',
  error: 'warning',
  stopped: 'neutral',
};

export const isActive = (status: RunStatus) => status === 'queued' || status === 'running';

export const LOAD_MODE_LABELS: Record<LoadMode, string> = { users: 'Users', rate: 'Rate' };

/** What a stage target counts in each mode, for labels and axes. */
export const TARGET_LABELS: Record<LoadMode, string> = {
  users: 'Virtual users',
  rate: 'Flow runs per second',
};

const TARGET_UNITS: Record<LoadMode, string> = { users: ' VUs', rate: '/s' };

export function formatStages(stages: Stage[], mode: LoadMode): string {
  return stages
    .map((stage) => `${stage.duration} → ${stage.target}${TARGET_UNITS[mode]}`)
    .join(', ');
}

export function peakTarget(stages: Stage[]): number {
  return Math.max(0, ...stages.map((stage) => stage.target));
}

/** The largest stage target with its unit: "20 VUs", or "50/s" for a rate run. */
export function formatPeak(run: Pick<Run, 'stages' | 'mode'>): string {
  return `${peakTarget(run.stages)}${TARGET_UNITS[run.mode]}`;
}

export function formatMs(value: number | undefined): string {
  if (value === undefined) return '–';
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value.toFixed(1)} ms`;
}

export function formatPercent(fraction: number | undefined): string {
  if (fraction === undefined) return '–';
  return `${(fraction * 100).toFixed(2)}%`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function durationSeconds(run: Run): number | undefined {
  if (!run.startedAt || !run.finishedAt) return undefined;
  return (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000;
}

const DURATION_UNIT_SECONDS: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600 };

/** "1m30s" → 90. Returns NaN when the string is not a k6 duration. */
export function durationToSeconds(duration: string): number {
  if (!/^(\d+(ms|s|m|h))+$/.test(duration)) return Number.NaN;
  let total = 0;
  for (const [, amount, unit] of duration.matchAll(/(\d+)(ms|s|m|h)/g)) {
    total += Number(amount) * (DURATION_UNIT_SECONDS[unit ?? 's'] ?? 0);
  }
  return total;
}

export interface PlannedPoint {
  second: number;
  virtualUsers: number;
}

/** Planned virtual users over time: k6 ramps linearly from one stage target to the next. */
export function plannedShape(stages: Stage[]): PlannedPoint[] {
  const points: PlannedPoint[] = [{ second: 0, virtualUsers: 0 }];
  let elapsed = 0;
  for (const stage of stages) {
    const seconds = durationToSeconds(stage.duration);
    if (!Number.isFinite(seconds)) return points;
    elapsed += seconds;
    points.push({ second: elapsed, virtualUsers: stage.target });
  }
  return points;
}

/**
 * The planned stage target at a second of a shape from plannedShape: k6 ramps in straight lines
 * between stage targets, and plans nothing after the last stage (the grace period).
 */
export function targetAt(points: PlannedPoint[], second: number): number {
  for (const [index, point] of points.entries()) {
    const previous = points[index - 1];
    if (!previous || second > point.second) continue;
    const span = point.second - previous.second;
    if (span <= 0) return point.virtualUsers;
    const share = (second - previous.second) / span;
    return previous.virtualUsers + (point.virtualUsers - previous.virtualUsers) * share;
  }
  return 0;
}

export function formatSeconds(value: number | string): string {
  if (Number(value) < 60) return `${Number(value)}s`;
  // Round once, so 3599.6 s reads 1h and never 59m60s.
  const seconds = Math.round(Number(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours === 0) return rest ? `${minutes}m${rest}s` : `${minutes}m`;
  if (rest) return `${hours}h${minutes}m${rest}s`;
  return minutes ? `${hours}h${minutes}m` : `${hours}h`;
}

// Plain-language explanations shared by the inline notes, so the wording stays the same everywhere.
export const EXPLAIN = {
  percentile:
    'A percentile of the response time. A p95 of 300 ms means 95 of every 100 requests took 300 ms or less; the slowest 5 took longer.',
  errorRate: 'Error rate is the share of requests that did not get the status their step expects.',
  failRule:
    'A run fails when any latency value reaches its limit (each must stay below it), when the error rate reaches the maximum, or when 99% or fewer of the checks pass. Checks confirm that each step got its expected status and saved its values, so a run can fail with a 0% error rate. A rate run also fails when it drops more of its planned flow runs than the max error rate allows.',
} as const;
