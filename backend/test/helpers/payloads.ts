// Request bodies for POST /runs. Each factory takes overrides for the field under test.
import type { CreateRunInput } from '../../src/modules/runs/schema.ts';
import { loadConfig } from '../../src/core/config.ts';

type FlowStepInput = NonNullable<CreateRunInput['flow']>[number];

export const TARGET_BASE_URL = loadConfig().DEFAULT_BASE_URL;

/** Limits loose enough that a short run against the demo app passes. */
export const PASSING_LIMITS = {
  maxErrorRate: 0.5,
  latencyLimitsMs: { p50: 10_000, p90: 10_000, p95: 10_000, p99: 10_000 },
} as const;

export function runPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { type: 'load', baseUrl: TARGET_BASE_URL, ...overrides };
}

/** A run of about a second, so lifecycle tests finish fast. */
export function shortRunPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return runPayload({
    stages: [{ duration: '1s', target: 1 }],
    thinkTimeSeconds: 0,
    ...PASSING_LIMITS,
    ...overrides,
  });
}

/** A run that keeps going until it is stopped. */
export function longRunPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return shortRunPayload({ stages: [{ duration: '1m', target: 1 }], ...overrides });
}

export function flowStep(overrides: Partial<FlowStepInput> = {}): FlowStepInput {
  return {
    name: 'Home',
    method: 'GET',
    path: '',
    headers: {},
    body: null,
    expectedStatus: 200,
    extract: [],
    ...overrides,
  };
}
