import type { BadgeTone } from '../../components/ui/index.ts';
import type { Run, RunStatus, RunType, Stage } from '../../api/runs.ts';

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
};

export const STATUS_TONES: Record<RunStatus, BadgeTone> = {
  queued: 'neutral',
  running: 'info',
  passed: 'success',
  failed: 'danger',
  error: 'warning',
};

export const isActive = (status: RunStatus) => status === 'queued' || status === 'running';

export function formatStages(stages: Stage[]): string {
  return stages.map((stage) => `${stage.duration} → ${stage.target} VUs`).join(', ');
}

export function peakUsers(stages: Stage[]): number {
  return Math.max(0, ...stages.map((stage) => stage.target));
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
