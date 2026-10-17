// Runs once before the workers start, so they share work that must not run N times at once:
// the k6 bundles every backend spawns, and Vite's dependency pre-bundle (several Vite servers
// filling a cold cache at once reload the page mid-test).
import { execFileSync } from 'node:child_process';
import { BACKEND_DIR, FRONTEND_DIR } from './servers.ts';

export default function setup(): void {
  execFileSync('pnpm', ['build:k6'], { cwd: BACKEND_DIR, stdio: ['ignore', 'ignore', 'inherit'] });
  // Vite warns that calling optimize by hand is deprecated, but it is the one entry point that
  // writes the cache before returning. Drop this step if a Vite upgrade removes the command.
  try {
    execFileSync('pnpm', ['exec', 'vite', 'optimize'], { cwd: FRONTEND_DIR, stdio: 'pipe' });
  } catch (error) {
    const output = (error as { stderr?: Buffer }).stderr?.toString() ?? '';
    throw new Error(`vite optimize failed\n${output}`, { cause: error });
  }
}
