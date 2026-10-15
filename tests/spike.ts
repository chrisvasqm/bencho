// Spike: sudden burst of traffic, then drop back.
import type { Options } from 'k6/options';
import { thresholds } from '../lib/thresholds.ts';
export { default } from '../lib/scenario.ts';

export const options: Options = {
  stages: [
    { duration: '10s', target: 5 }, // baseline
    { duration: '10s', target: 100 }, // spike
    { duration: '30s', target: 100 }, // hold spike
    { duration: '10s', target: 5 }, // recover
    { duration: '30s', target: 5 },
    { duration: '10s', target: 0 },
  ],
  thresholds: thresholds({ maxErrorRate: 0.05, p95Ms: 2000 }),
};
