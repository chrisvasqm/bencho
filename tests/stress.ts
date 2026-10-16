// Stress: push past normal load in steps to find the breaking point.
import { buildOptions } from '../lib/options.ts';
export { default } from '../lib/scenario.ts';

export const options = buildOptions([
  { duration: '30s', target: 20 },
  { duration: '1m', target: 20 },
  { duration: '30s', target: 50 },
  { duration: '1m', target: 50 },
  { duration: '30s', target: 0 },
]);
