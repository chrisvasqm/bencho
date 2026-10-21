// Builds k6 options for a test: its load shape plus the shared pass/fail limits from config.
import type { Options, Stage } from 'k6/options';
import { config, stagesFromEnv } from './config.ts';

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
  return {
    ...common,
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
