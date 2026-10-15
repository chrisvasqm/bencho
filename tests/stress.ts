// Stress: push past normal load in steps to find the breaking point.
import type { Options } from 'k6/options';
import { thresholds } from '../lib/thresholds.ts';
export { default } from '../lib/scenario.ts';

export const options: Options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: thresholds({ maxErrorRate: 0.05, p95Ms: 1000 }),
};
