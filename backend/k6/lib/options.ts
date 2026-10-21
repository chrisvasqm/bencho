// Builds k6 options for a test: its load shape plus the shared pass/fail limits from config.
import type { Options, Stage } from 'k6/options';
import { config, stagesFromEnv } from './config.ts';
import { durationToSeconds } from './defaults.ts';

/** Flow runs a rate shape plans in total: the area under its straight-line ramps, from 0. */
function plannedRuns(stages: Stage[]): number {
  let previous = 0;
  let total = 0;
  for (const stage of stages) {
    total += ((previous + stage.target) / 2) * durationToSeconds(stage.duration);
    previous = stage.target;
  }
  return total;
}

export function buildOptions(defaultStages: Stage[]): Options {
  const { p50, p90, p95, p99 } = config.latencyLimitsMs;
  const stages = stagesFromEnv(defaultStages);
  const common: Options = {
    thresholds: {
      http_req_failed: [`rate<${config.maxErrorRate}`],
      http_req_duration: [`p(50)<${p50}`, `p(90)<${p90}`, `p(95)<${p95}`, `p(99)<${p99}`],
      checks: ['rate>0.99'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
    // Saves VU memory. Default for any request; scenario.ts sets responseType per step (text to extract).
    discardResponseBodies: true,
  };
  if (config.mode === 'users') return { ...common, stages };
  const { maxVirtualUsers } = config;
  const peakRate = Math.max(0, ...stages.map((stage) => stage.target));
  // A rate run that cannot keep its rate fails: dropped runs count against the error budget.
  const allowedDrops = Math.floor(plannedRuns(stages) * config.maxErrorRate);
  return {
    ...common,
    thresholds: { ...common.thresholds, dropped_iterations: [`count<=${allowedDrops}`] },
    scenarios: {
      rate: {
        executor: 'ramping-arrival-rate',
        startRate: 0,
        timeUnit: '1s',
        stages,
        // A flow run takes at least about a second (think time), so the peak rate is a fair first
        // guess; k6 adds VUs up to maxVUs when runs take longer, and drops runs past that.
        preAllocatedVUs: Math.max(1, Math.min(maxVirtualUsers, peakRate)),
        maxVUs: maxVirtualUsers,
      },
    },
  };
}
