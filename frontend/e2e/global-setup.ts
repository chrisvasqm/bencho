// Runs once before the workers start, so they share work that must not run N times at once:
// the k6 bundles every backend spawns, and Vite's dependency pre-bundle (a cold cache in
// several Vite servers at once reloads the page mid-test).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'vite';

const FRONTEND_DIR = path.resolve(import.meta.dirname, '..');
const BACKEND_DIR = path.resolve(FRONTEND_DIR, '..', 'backend');

export default async function setup(): Promise<void> {
  execFileSync('pnpm', ['build:k6'], { cwd: BACKEND_DIR, stdio: ['ignore', 'ignore', 'inherit'] });
  const vite = await createServer({
    root: FRONTEND_DIR,
    logLevel: 'error',
    server: { middlewareMode: true },
  });
  try {
    await vite.warmupRequest('/src/main.tsx');
    await vite.waitForRequestsIdle();
  } finally {
    await vite.close();
  }
}
