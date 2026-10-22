import type { BadgeTone } from '../../components/ui/index.ts';
import type { LoadMode, Run, RunStatus, RunType, Stage } from '../../api/runs.ts';
import type { Copy } from '../../i18n/useCopy.ts';

export const STATUS_TONES: Record<RunStatus, BadgeTone> = {
  queued: 'neutral',
  running: 'info',
  passed: 'success',
  failed: 'danger',
  error: 'warning',
  stopped: 'neutral',
};

/** The run type for a sentence: each language uses the form its grammar needs. */
export function runTypeVars(type: RunType, t: Copy) {
  return { type: t(`runType.${type}`), typeLower: t(`runTypeLower.${type}`) };
}

export const isActive = (status: RunStatus) => status === 'queued' || status === 'running';

/** The latency percentiles a run is judged on, with the key k6 stores each under. */
export const LATENCY_KEYS = [
  ['p50', 'med'],
  ['p90', 'p(90)'],
  ['p95', 'p(95)'],
  ['p99', 'p(99)'],
] as const;

/** Flow runs a rate shape plans in total: the area under its straight-line ramps, from 0. */
export function plannedRuns(stages: Stage[]): number {
  let previous = 0;
  let total = 0;
  for (const stage of stages) {
    total += ((previous + stage.target) / 2) * durationToSeconds(stage.duration);
    previous = stage.target;
  }
  return total;
}

/** Whole VUs, or a rate with at most 2 decimals (0.25 = one flow run every 4 s). Same as the API. */
export function isValidTarget(target: number, mode: LoadMode): boolean {
  if (!Number.isFinite(target) || target < 0) return false;
  if (mode === 'users') return Number.isSafeInteger(target);
  // toFixed compares at any size, where a fixed tolerance fails on large rates.
  return Number(target.toFixed(2)) === target && Number.isSafeInteger(Math.round(target * 3600));
}

/** "20 users" (or "20 VUs" in Advanced), or "50/s" for a rate run. */
export function formatTarget(target: number, mode: LoadMode, t: Copy): string {
  return mode === 'rate'
    ? t('runs.unitRate', { count: target })
    : t('runs.unitUsers', { count: target });
}

export function formatStages(stages: Stage[], mode: LoadMode, t: Copy): string {
  return stages
    .map((stage) => `${stage.duration} → ${formatTarget(stage.target, mode, t)}`)
    .join(', ');
}

export function peakTarget(stages: Stage[]): number {
  // A target still being typed (NaN) must not hide the others, such as in the capacity warning.
  return Math.max(0, ...stages.map((stage) => stage.target).filter(Number.isFinite));
}

/** The largest stage target with its unit. */
export function formatPeak(run: Pick<Run, 'stages' | 'mode'>, t: Copy): string {
  return formatTarget(peakTarget(run.stages), run.mode, t);
}

export function formatMs(value: number | undefined): string {
  if (value === undefined) return '–';
  // Seconds with 2 decimals read easier than milliseconds for people new to load tests.
  return `${(value / 1000).toFixed(2)} s`;
}

export function formatPercent(fraction: number | undefined): string {
  if (fraction === undefined) return '–';
  return `${(fraction * 100).toFixed(2)}%`;
}

export function formatTime(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AGO_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "18 min. ago", "2 hr. ago", "yesterday": how long ago, for a list row. */
export function formatAgo(iso: string, language: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' });
  for (const [unit, size] of AGO_UNITS) {
    if (seconds >= size) return format.format(-Math.floor(seconds / size), unit);
  }
  return format.format(0, 'second');
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
    // A target still being typed (not a number yet) draws as 0.
    points.push({
      second: elapsed,
      virtualUsers: Number.isFinite(stage.target) ? stage.target : 0,
    });
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

/** Seconds all stages take together: how long the run was planned to last. */
export function plannedSeconds(stages: Stage[]): number {
  return stages.reduce((total, stage) => total + (durationToSeconds(stage.duration) || 0), 0);
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
