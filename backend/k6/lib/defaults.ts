// Default settings shared by the k6 tests and the backend API. No k6 imports: Node reads this too.
export const RUN_TYPES = ['load', 'stress', 'spike'] as const;
export type RunType = (typeof RUN_TYPES)[number];

/**
 * users: stage targets are virtual users (k6 ramping-vus).
 * rate: stage targets are flow runs (iterations) started per second (k6 ramping-arrival-rate).
 */
export const LOAD_MODES = ['users', 'rate'] as const;
export type LoadMode = (typeof LOAD_MODES)[number];

/** Most VUs a rate run may add to keep its rate, when the run does not set its own. */
export const DEFAULT_MAX_VIRTUAL_USERS = 100;

/** Rate targets may go below 1 per second, in steps of 0.01 (one every 100 seconds). */
export const RATE_TARGET_DECIMALS = 2;
/** k6 gets rates per hour, so every 2-decimal rate per second is a whole number for it. */
export const RATE_TIME_UNIT_SECONDS = 3600;

/** A valid stage target for the mode: whole VUs, or a rate with at most two decimals. */
export function isValidTarget(target: number, mode: LoadMode): boolean {
  if (!Number.isFinite(target) || target < 0) return false;
  if (mode === 'users') return Number.isSafeInteger(target);
  // toFixed compares at any size, where a fixed tolerance fails on large rates.
  const hasDecimals = Number(target.toFixed(RATE_TARGET_DECIMALS)) === target;
  return hasDecimals && Number.isSafeInteger(Math.round(target * RATE_TIME_UNIT_SECONDS));
}

export interface LoadStage {
  duration: string;
  target: number;
}

export interface LatencyLimitsMs {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface RunLimits {
  thinkTimeSeconds: number;
  /**
   * Seconds a VU may finish its flow run after the shape removes it, and after the last stage.
   * Optional: runs stored before this setting existed do not have it.
   */
  gracePeriodSeconds?: number;
  maxErrorRate: number;
  latencyLimitsMs: LatencyLimitsMs;
}

export const DURATION_PATTERN = /^(\d+(ms|s|m|h))+$/;

export const DEFAULT_LIMITS: Required<RunLimits> = {
  thinkTimeSeconds: 1,
  // k6's own default for gracefulRampDown and gracefulStop.
  gracePeriodSeconds: 30,
  maxErrorRate: 0.01,
  latencyLimitsMs: { p50: 200, p90: 400, p95: 500, p99: 1000 },
};

export const DEFAULT_STAGES: Record<RunType, LoadStage[]> = {
  // Load: normal expected traffic, steady.
  load: [
    { duration: '30s', target: 10 }, // ramp up
    { duration: '1m', target: 10 }, // hold
    { duration: '30s', target: 0 }, // ramp down
  ],
  // Stress: push past normal load in steps to find the breaking point.
  stress: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  // Spike: sudden burst of traffic, then drop back.
  spike: [
    { duration: '10s', target: 5 }, // baseline
    { duration: '10s', target: 100 }, // spike
    { duration: '30s', target: 100 }, // hold spike
    { duration: '10s', target: 5 }, // recover
    { duration: '30s', target: 5 },
    { duration: '10s', target: 0 },
  ],
};

/** Serializes stages as the STAGES env var: "30s:10,1m:10,30s:0". */
export function stagesToEnv(stages: LoadStage[]): string {
  return stages.map((stage) => `${stage.duration}:${stage.target}`).join(',');
}

const DURATION_UNIT_SECONDS: Record<string, number> = { ms: 0.001, s: 1, m: 60, h: 3600 };

/** "1m30s" → 90. Assumes the string already matches DURATION_PATTERN. */
export function durationToSeconds(duration: string): number {
  let total = 0;
  for (const [, amount, unit] of duration.matchAll(/(\d+)(ms|s|m|h)/g)) {
    total += Number(amount) * (DURATION_UNIT_SECONDS[unit ?? 's'] ?? 0);
  }
  return total;
}
