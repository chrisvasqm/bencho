// A stored run as the input that starts a run: Retry sends it as is, Reuse edits it.
import type { CreateRunInput, Run } from '../../api/runs.ts';

/** What the API returns in place of a secret header value (Authorization, cookies, keys...). */
export const REDACTED = '[redacted]';

/** True when a header value of the run was redacted: the run cannot be repeated as it is. */
export function hasRedactedSecrets(run: Pick<Run, 'flow'>): boolean {
  return run.flow.some((step) => Object.values(step.headers).includes(REDACTED));
}

/** The settings of a stored run, ready to start again as they were. */
export function runToInput(run: Run): CreateRunInput {
  return {
    type: run.type,
    baseUrl: run.baseUrl,
    mode: run.mode,
    ...(run.mode === 'rate' &&
      run.maxVirtualUsers !== null && { maxVirtualUsers: run.maxVirtualUsers }),
    stages: run.stages.map(({ duration, target }) => ({ duration, target })),
    flow: run.flow,
    thinkTimeSeconds: run.limits.thinkTimeSeconds,
    gracePeriodSeconds: run.limits.gracePeriodSeconds,
    maxErrorRate: run.limits.maxErrorRate,
    latencyLimitsMs: run.limits.latencyLimitsMs,
  };
}
