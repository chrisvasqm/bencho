// Node entry point: loads .env, then hands off to k6, which runs the TS test natively.
// k6 has its own JS runtime (not Node), so dotenv must run here, not inside the test.
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ quiet: true });

const TEST_NAMES = ['load', 'stress', 'spike'];
const testName = process.argv[2] ?? '';

if (!TEST_NAMES.includes(testName)) {
  console.error(`Usage: tsx scripts/run.ts <${TEST_NAMES.join('|')}>`);
  process.exit(1);
}

const k6Process = spawnSync('k6', ['run', `tests/${testName}.ts`], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(k6Process.status ?? 1);
