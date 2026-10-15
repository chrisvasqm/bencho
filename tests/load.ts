// Load: normal expected traffic, steady.
import type { Options } from 'k6/options';
import { thresholds } from '../lib/thresholds.ts';
export { default } from '../lib/scenario.ts';

export const options: Options = {
  stages: [
    { duration: '30s', target: 10 }, // ramp up
    { duration: '1m', target: 10 }, // hold
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: thresholds({ maxErrorRate: 0.01, p95Ms: 500 }),
};
