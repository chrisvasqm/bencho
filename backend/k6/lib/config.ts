// Run settings from env vars (k6 __ENV). Every value has a default, so tests run with no setup.
import type { Stage } from 'k6/options';
import {
  DEFAULT_LIMITS,
  DEFAULT_MAX_VIRTUAL_USERS,
  DURATION_PATTERN,
  LOAD_MODES,
  isValidTarget,
  type LoadMode,
} from './defaults.ts';

function numberFromEnv(name: string, fallback: number): number {
  const raw = __ENV[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a number of 0 or more, got "${raw}"`);
  }
  return value;
}

function parseStage(entry: string, mode: LoadMode): Stage {
  const [duration = '', rawTarget = ''] = entry.trim().split(':');
  const target = Number(rawTarget);
  if (!DURATION_PATTERN.test(duration) || !isValidTarget(target, mode)) {
    const rule = mode === 'rate' ? 'a rate with at most 2 decimals' : 'whole VUs';
    throw new Error(
      `STAGES entry "${entry}" must be <duration>:<target> (${rule}), such as 30s:10`,
    );
  }
  return { duration, target };
}

/** MODE=rate starts a set number of flow runs per second; MODE=users (default) ramps VUs. */
function modeFromEnv(): LoadMode {
  const raw = __ENV.MODE || 'users';
  if (!(LOAD_MODES as readonly string[]).includes(raw)) {
    throw new Error(`MODE must be one of ${LOAD_MODES.join(', ')}, got "${raw}"`);
  }
  return raw as LoadMode;
}

function maxVirtualUsersFromEnv(): number {
  const value = numberFromEnv('MAX_VUS', DEFAULT_MAX_VIRTUAL_USERS);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`MAX_VUS must be a whole number of 1 or more, got "${__ENV.MAX_VUS}"`);
  }
  return value;
}

/** Whole seconds, so k6 gets a duration such as 30s, as the API allows. */
function gracePeriodFromEnv(): number {
  const value = numberFromEnv('GRACE_PERIOD_SECONDS', gracePeriodSeconds);
  if (!Number.isInteger(value)) {
    throw new Error(
      `GRACE_PERIOD_SECONDS must be whole seconds, got "${__ENV.GRACE_PERIOD_SECONDS}"`,
    );
  }
  return value;
}

/** STAGES="30s:10,1m:10,30s:0" replaces the test's default load shape. */
export function stagesFromEnv(defaultStages: Stage[]): Stage[] {
  const raw = __ENV.STAGES;
  return raw ? raw.split(',').map((entry) => parseStage(entry, config.mode)) : defaultStages;
}

const { thinkTimeSeconds, gracePeriodSeconds, maxErrorRate, latencyLimitsMs } = DEFAULT_LIMITS;

export const config = {
  baseUrl: __ENV.BASE_URL || 'http://localhost:10001',
  mode: modeFromEnv(),
  /** Read only in rate mode, so a stray MAX_VUS never breaks a users run. */
  maxVirtualUsers: modeFromEnv() === 'rate' ? maxVirtualUsersFromEnv() : DEFAULT_MAX_VIRTUAL_USERS,
  thinkTimeSeconds: numberFromEnv('THINK_TIME_SECONDS', thinkTimeSeconds),
  gracePeriodSeconds: gracePeriodFromEnv(),
  maxErrorRate: numberFromEnv('MAX_ERROR_RATE', maxErrorRate),
  latencyLimitsMs: {
    p50: numberFromEnv('P50_MS', latencyLimitsMs.p50),
    p90: numberFromEnv('P90_MS', latencyLimitsMs.p90),
    p95: numberFromEnv('P95_MS', latencyLimitsMs.p95),
    p99: numberFromEnv('P99_MS', latencyLimitsMs.p99),
  },
};
