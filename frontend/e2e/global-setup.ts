// Runs once before the workers start: pre-bundles the app's dependencies, so the Vite servers
// the workers start do not all optimize at once and reload the page mid-test.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default function setup(): void {
  execFileSync('pnpm', ['exec', 'vite', 'optimize'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: 'pipe',
  });
}
