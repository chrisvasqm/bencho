// Spike: sudden burst of traffic, then drop back.
import { buildOptions } from '../lib/options.ts';
export { default } from '../lib/scenario.ts';

export const options = buildOptions([
  { duration: '10s', target: 5 }, // baseline
  { duration: '10s', target: 100 }, // spike
  { duration: '30s', target: 100 }, // hold spike
  { duration: '10s', target: 5 }, // recover
  { duration: '30s', target: 5 },
  { duration: '10s', target: 0 },
]);
