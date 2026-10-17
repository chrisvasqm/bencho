// One backend (own throwaway database, real k6) and one Vite dev server per Playwright worker,
// on ports picked by the worker's index, so workers never share runs or the backend's cap on
// runs in progress.
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// Slots 13 and 14 of the default range for the first worker, the next two for the second...
const BACKEND_BASE_PORT = Number(process.env.E2E_BACKEND_PORT ?? 10013);
const FRONTEND_BASE_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 10014);
const START_TIMEOUT_MS = 120_000;
const STOP_TIMEOUT_MS = 15_000;
const FRONTEND_DIR = path.resolve(import.meta.dirname, '..');
const BACKEND_DIR = path.resolve(FRONTEND_DIR, '..', 'backend');

export interface Servers {
  baseURL: string;
  stop: () => Promise<void>;
}

/** Starts both servers for worker `index` and waits until they answer. */
export async function startServers(index: number): Promise<Servers> {
  const backendPort = BACKEND_BASE_PORT + 2 * index;
  const frontendPort = FRONTEND_BASE_PORT + 2 * index;
  const backend = new Server('backend', ['e2e:server'], BACKEND_DIR, {
    PORT: String(backendPort),
  });
  const frontend = new Server('vite', ['exec', 'vite', '--strictPort'], FRONTEND_DIR, {
    FRONTEND_PORT: String(frontendPort),
    BACKEND_PORT: String(backendPort),
  });
  const stop = async () => {
    await Promise.all([frontend.stop(), backend.stop()]);
  };
  try {
    await Promise.all([
      backend.waitFor(`http://localhost:${backendPort}/api/v1/health`),
      frontend.waitFor(`http://localhost:${frontendPort}`),
    ]);
  } catch (error) {
    await stop();
    throw error;
  }
  return { baseURL: `http://localhost:${frontendPort}`, stop };
}

class Server {
  private readonly child: ChildProcess;
  private readonly output: string[] = [];
  private readonly exited: Promise<number | null>;

  constructor(
    private readonly name: string,
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
      stream?.on('data', (chunk: Buffer) => this.output.push(chunk.toString()));
    }
    this.exited = new Promise((resolve) => this.child.once('exit', resolve));
  }

  /** Resolves once `url` answers 2xx; rejects if the process exits or the timeout passes. */
  async waitFor(url: string): Promise<void> {
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (this.child.exitCode !== null) throw this.error(`exited with code ${this.child.exitCode}`);
      if (await this.answers(url)) return;
      await sleep(250);
    }
    throw this.error(`did not answer at ${url} within ${START_TIMEOUT_MS / 1000} s`);
  }

  /** SIGTERM to the process group, so the backend drops its database on the way out. */
  async stop(): Promise<void> {
    if (this.child.exitCode !== null || this.child.pid === undefined) return;
    this.signal('SIGTERM');
    const exited = await Promise.race([this.exited, sleep(STOP_TIMEOUT_MS, 'timeout')]);
    if (exited === 'timeout') {
      this.signal('SIGKILL');
      await this.exited;
    }
  }

  private signal(signal: NodeJS.Signals): void {
    try {
      process.kill(-this.child.pid!, signal);
    } catch {
      // Already gone.
    }
  }

  private async answers(url: string): Promise<boolean> {
    try {
      return (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
    } catch {
      return false;
    }
  }

  private error(what: string): Error {
    return new Error(`e2e ${this.name} server ${what}\n${this.output.join('')}`);
  }
}
