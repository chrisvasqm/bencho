// One backend (own throwaway database, real k6) and one Vite dev server per Playwright worker,
// on ports picked by the worker's index, so workers never share runs or the backend's cap on
// runs in progress. POSIX only (process groups), like the stack scripts.
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// Slots 13 and 14 of the default range for the first worker, the next two for the second...
const PORT_BASE = Number(process.env.E2E_PORT_BASE ?? 10013);
const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 15_000;
const KEPT_OUTPUT_CHUNKS = 200;
export const FRONTEND_DIR = path.resolve(import.meta.dirname, '..');
export const BACKEND_DIR = path.resolve(FRONTEND_DIR, '..', 'backend');

export interface Servers {
  baseURL: string;
  stop: () => Promise<void>;
}

/** Starts both servers for worker `index` and waits until they answer. */
export async function startServers(index: number): Promise<Servers> {
  const backendPort = PORT_BASE + 2 * index;
  const frontendPort = backendPort + 1;
  const backendUrl = `http://localhost:${backendPort}/api/v1/health`;
  const frontendUrl = `http://localhost:${frontendPort}`;
  // A server left over from an earlier run would answer in place of the one started here.
  for (const url of [backendUrl, frontendUrl]) {
    if (await answers(url)) throw new Error(`e2e: ${url} already answers; stop that server first`);
  }
  // The k6 bundles are built once, in global-setup.ts.
  const backend = new Server('backend', backendUrl, ['e2e:server'], BACKEND_DIR, {
    PORT: String(backendPort),
  });
  const frontend = new Server('vite', frontendUrl, ['exec', 'vite', '--strictPort'], FRONTEND_DIR, {
    FRONTEND_PORT: String(frontendPort),
    BACKEND_PORT: String(backendPort),
  });
  const stop = async () => {
    await Promise.all([frontend.stop(), backend.stop()]);
  };
  const ready = [backend.waitFor(), frontend.waitFor()];
  try {
    await Promise.all(ready);
  } catch (error) {
    await stop();
    // The other wait ends too once its server is stopped; its error is not the cause.
    await Promise.allSettled(ready);
    throw error;
  }
  return { baseURL: frontendUrl, stop };
}

class Server {
  private readonly child: ChildProcess;
  private readonly output: string[] = [];
  private readonly exited: Promise<void>;
  private spawnError?: Error;

  constructor(
    private readonly name: string,
    private readonly url: string,
    args: string[],
    cwd: string,
    env: Record<string, string>,
  ) {
    // Own process group: a signal to the group reaches pnpm and the node process it runs.
    this.child = spawn('pnpm', args, {
      cwd,
      env: { ...process.env, ...env },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    for (const stream of [this.child.stdout, this.child.stderr]) {
      stream?.on('data', (chunk: Buffer) => this.keep(chunk.toString()));
    }
    this.exited = new Promise((resolve) => {
      this.child.once('exit', () => resolve());
      this.child.once('error', (error) => {
        this.spawnError = error;
        resolve();
      });
    });
    // Last resort when the worker exits without running the fixture teardown; SIGTERM, so
    // the backend still drops its database.
    process.once('exit', () => this.signal('SIGTERM'));
  }

  /** Resolves once the server answers 2xx; rejects if the process exits or the timeout passes. */
  async waitFor(): Promise<void> {
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      // No pid: spawn failed and its 'error' event is about to say why.
      if (this.child.pid === undefined) await this.exited;
      if (this.spawnError) throw this.error(`could not start: ${this.spawnError.message}`);
      if (this.gone) throw this.error(`exited (${this.child.exitCode ?? this.child.signalCode})`);
      if (await answers(this.url)) return;
      await sleep(250);
    }
    throw this.error(`did not answer at ${this.url} within ${START_TIMEOUT_MS / 1000} s`);
  }

  /**
   * SIGTERM to the process group, so the backend drops its database on the way out. pnpm exits
   * before the server it runs, so the port going silent is what counts, not pnpm's exit.
   */
  async stop(): Promise<void> {
    if (this.child.pid === undefined) return;
    this.signal('SIGTERM');
    if (await this.silentWithin(STOP_TIMEOUT_MS)) return;
    this.signal('SIGKILL');
    await this.silentWithin(STOP_TIMEOUT_MS);
  }

  private async silentWithin(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await answers(this.url))) return true;
      await sleep(250);
    }
    return false;
  }

  private get gone(): boolean {
    return (
      this.child.pid === undefined || this.child.exitCode !== null || this.child.signalCode !== null
    );
  }

  private signal(signal: NodeJS.Signals): void {
    if (this.child.pid === undefined) return;
    try {
      process.kill(-this.child.pid!, signal);
    } catch {
      // Already gone.
    }
  }

  private keep(chunk: string): void {
    this.output.push(chunk);
    if (this.output.length > KEPT_OUTPUT_CHUNKS) this.output.shift();
  }

  private error(what: string): Error {
    return new Error(`e2e ${this.name} server ${what}\n${this.output.join('')}`);
  }
}

async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
  } catch {
    return false;
  }
}
