// Load: normal expected traffic, steady.
import { buildOptions } from '../lib/options.ts';
export { default } from '../lib/scenario.ts';

export const options = buildOptions([
  { duration: '30s', target: 10 }, // ramp up
  { duration: '1m', target: 10 }, // hold
  { duration: '30s', target: 0 }, // ramp down
]);
