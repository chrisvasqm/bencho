// Run settings from env vars (k6 __ENV). Every value has a default, so tests run with no setup.
import type { Stage } from 'k6/options';
import { DEFAULT_LIMITS, DEFAULT_MAX_VIRTUAL_USERS, DURATION_PATTERN } from './defaults.ts';

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

function maxVirtualUsersFromEnv(): number {
  const value = numberFromEnv('MAX_VUS', DEFAULT_MAX_VIRTUAL_USERS);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`MAX_VUS must be a whole number of 1 or more, got "${__ENV.MAX_VUS}"`);
  }
  return value;
}

/** STAGES="30s:10,1m:10,30s:0" replaces the test's default load shape. */
export function stagesFromEnv(defaultStages: Stage[]): Stage[] {
  const raw = __ENV.STAGES;
  return raw ? raw.split(',').map(parseStage) : defaultStages;
}

const { thinkTimeSeconds, maxErrorRate, latencyLimitsMs } = DEFAULT_LIMITS;

export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:10001',
  /** MODE=rate starts a fixed number of flow runs per second; anything else ramps VUs. */
  mode: __ENV.MODE === 'rate' ? ('rate' as const) : ('users' as const),
  maxVirtualUsers: maxVirtualUsersFromEnv(),
  thinkTimeSeconds: numberFromEnv('THINK_TIME_SECONDS', thinkTimeSeconds),
  maxErrorRate: numberFromEnv('MAX_ERROR_RATE', maxErrorRate),
  latencyLimitsMs: {
    p50: numberFromEnv('P50_MS', latencyLimitsMs.p50),
    p90: numberFromEnv('P90_MS', latencyLimitsMs.p90),
    p95: numberFromEnv('P95_MS', latencyLimitsMs.p95),
    p99: numberFromEnv('P99_MS', latencyLimitsMs.p99),
  },
};
