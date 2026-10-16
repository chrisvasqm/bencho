// Default settings shared by the k6 tests and the backend API. No k6 imports: Node reads this too.
export const RUN_TYPES = ['load', 'stress', 'spike'] as const;
export type RunType = (typeof RUN_TYPES)[number];

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
  maxErrorRate: number;
  latencyLimitsMs: LatencyLimitsMs;
}

export const DURATION_PATTERN = /^(\d+(ms|s|m|h))+$/;

export const DEFAULT_LIMITS: RunLimits = {
  thinkTimeSeconds: 1,
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
