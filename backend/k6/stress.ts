import { buildOptions } from './lib/options.ts';
import { DEFAULT_STAGES } from './lib/defaults.ts';
export { default } from './lib/scenario.ts';

export const options = buildOptions(DEFAULT_STAGES.stress);
