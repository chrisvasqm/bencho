// A stored run as the input that starts a run: Run again sends it as is, Change and run edits it.
import type { CreateRunInput, Run } from '../../api/runs.ts';

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
