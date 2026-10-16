// Builds k6 options for a test: its load shape plus the shared pass/fail limits from config.
import type { Options, Stage } from 'k6/options';
import { config, stagesFromEnv } from './config.ts';

export function buildOptions(defaultStages: Stage[]): Options {
  const { p50, p90, p95, p99 } = config.latencyLimitsMs;
  return {
    stages: stagesFromEnv(defaultStages),
    thresholds: {
      http_req_failed: [`rate<${config.maxErrorRate}`],
      http_req_duration: [`p(50)<${p50}`, `p(90)<${p90}`, `p(95)<${p95}`, `p(99)<${p99}`],
      checks: ['rate>0.99'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  };
}
