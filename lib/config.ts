// Run settings from env vars (k6 __ENV). Every value has a default, so tests run with no setup.
import type { Stage } from 'k6/options';

const DURATION_PATTERN = /^(\d+(ms|s|m|h))+$/;

function numberFromEnv(name: string, fallback: number): number {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a number of 0 or more, got "${raw}"`);
  }
  return value;
}

function parseStage(entry: string): Stage {
  const [duration = '', target = ''] = entry.trim().split(':');
  const virtualUsers = Number(target);
  if (!DURATION_PATTERN.test(duration) || !Number.isInteger(virtualUsers) || virtualUsers < 0) {
    throw new Error(`STAGES entry "${entry}" must be <duration>:<VUs>, for example 30s:10`);
  }
  return { duration, target: virtualUsers };
}

/** STAGES="30s:10,1m:10,30s:0" replaces the test's default load shape. */
export function stagesFromEnv(defaultStages: Stage[]): Stage[] {
  const raw = __ENV.STAGES;
  return raw ? raw.split(',').map(parseStage) : defaultStages;
}

export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:3333',
  thinkTimeSeconds: numberFromEnv('THINK_TIME_SECONDS', 1),
  maxErrorRate: numberFromEnv('MAX_ERROR_RATE', 0.01),
  latencyLimitsMs: {
    p50: numberFromEnv('P50_MS', 200),
    p90: numberFromEnv('P90_MS', 400),
    p95: numberFromEnv('P95_MS', 500),
    p99: numberFromEnv('P99_MS', 1000),
  },
};
