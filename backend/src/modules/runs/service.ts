// Starts k6 runs as child processes and records their outcome.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../../core/errors.ts';
import { DEFAULT_LIMITS, DEFAULT_STAGES, stagesToEnv } from '../../../k6/lib/defaults.ts';
import { DEFAULT_FLOW, isFullUrl } from '../../../k6/lib/flow.ts';
import type { RunsRepository } from './repository.ts';
import {
  K6_ABORTED_EXIT_CODE,
  PRIVATE_HOSTNAMES,
  PRIVATE_IP_RANGES,
  PRIVATE_TARGET_MESSAGE,
  privateTargetProblem,
} from './targets.ts';
import { FileTail, TimeseriesAggregator, type RunPointValues } from './timeseries.ts';
import {
  ACTIVE_RUN_STATUSES,
  type CreateRunInput,
  type ListRunsQuery,
  type NewRun,
  type Run,
  type RunPoint,
  type RunStatus,
} from './schema.ts';

const K6_THRESHOLD_FAILED_EXIT_CODE = 99;
/** After SIGINT, k6 gets this long to stop gracefully (and write its summary) before SIGKILL. */
const STOP_GRACE_MS = 10_000;
const MAX_CONCURRENT_RUNS = 3;
const POINTS_FLUSH_INTERVAL_MS = 2000;
/** Flow headers that carry a secret of the target, by name. Stored for the run, never returned. */
const SECRET_HEADER_PATTERN = /auth|token|key|secret|cookie|session|password/i;
const REDACTED = '[redacted]';

export interface K6Settings {
  bundleDir: string;
  defaultBaseUrl: string;
  /** Runs may target private, loopback and link-local addresses (SSRF when exposed). Read per run. */
  allowPrivateTargets: () => boolean;
}

export class RunsService {
  private readonly inFlight = new Set<Promise<void>>();
  /** Slots taken by start() calls still inserting their row; counted with inFlight for the cap. */
  private starting = 0;
  /** k6 processes by run id, so a run can be stopped. */
  private readonly processes = new Map<string, ChildProcess>();
  /** Runs this process is executing (queued or running). */
  private readonly executing = new Set<string>();
  /** Runs the user asked to stop; their outcome is recorded as 'stopped'. */
  private readonly stopRequested = new Set<string>();

  constructor(
    private readonly repository: RunsRepository,
    private readonly k6: K6Settings,
  ) {}

  defaults() {
    return {
      baseUrl: this.k6.defaultBaseUrl,
      stages: DEFAULT_STAGES,
      limits: DEFAULT_LIMITS,
      flow: DEFAULT_FLOW,
    };
  }

  /** Stores the run as queued and starts k6 in the background. Poll getById for the outcome. */
  async start(input: CreateRunInput): Promise<Run> {
    this.assertTargetAllowed(input);
    // Reserve the slot before the first await, so parallel requests cannot all pass the check.
    if (this.inFlight.size + this.starting >= MAX_CONCURRENT_RUNS) {
      throw new AppError(
        409,
        'TOO_MANY_RUNS',
        `At most ${MAX_CONCURRENT_RUNS} runs can be in progress. Wait for one to finish.`,
      );
    }
    this.starting += 1;
    let run: Run;
    try {
      run = await this.repository.create({
        type: input.type,
        baseUrl: input.baseUrl,
        stages: input.stages ?? DEFAULT_STAGES[input.type],
        flow: input.flow ?? DEFAULT_FLOW,
        limits: {
          thinkTimeSeconds: input.thinkTimeSeconds ?? DEFAULT_LIMITS.thinkTimeSeconds,
          maxErrorRate: input.maxErrorRate ?? DEFAULT_LIMITS.maxErrorRate,
          latencyLimitsMs: input.latencyLimitsMs ?? DEFAULT_LIMITS.latencyLimitsMs,
        },
      });
    } finally {
      this.starting -= 1;
    }
    this.executing.add(run.id);
    const execution = this.execute(run).finally(() => this.inFlight.delete(execution));
    this.inFlight.add(execution);
    return redactSecrets(run);
  }

  /**
   * Literal private hosts are refused here with a clear error; a host that resolves to a private
   * address is refused by k6 on the first request (K6_BLACKLIST_IPS, K6_BLOCK_HOSTNAMES), which
   * aborts the run.
   */
  private assertTargetAllowed(input: CreateRunInput): void {
    if (this.k6.allowPrivateTargets()) return;
    const fullUrls = (input.flow ?? []).map((step) => step.path).filter(isFullUrl);
    for (const url of [input.baseUrl, ...fullUrls]) {
      const problem = privateTargetProblem(url);
      if (problem) throw new AppError(400, 'TARGET_NOT_ALLOWED', problem);
    }
  }

  async getById(id: string): Promise<Run> {
    const run = await this.repository.findById(id);
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Run not found');
    return redactSecrets(run);
  }

  async listPoints(id: string): Promise<RunPoint[]> {
    await this.getById(id);
    return this.repository.listPoints(id);
  }

  /** Call once at startup, before accepting runs. */
  async failUnfinishedRuns(): Promise<number> {
    return this.repository.failUnfinished('The backend restarted while this run was in progress.');
  }

  async list({ type, active, page, pageSize }: ListRunsQuery) {
    const { runs, total } = await this.repository.listPage(type, active, page, pageSize);
    return { runs: runs.map(redactSecrets), total, page, pageSize };
  }

  /** Deletes the finished runs among `ids`. Runs in progress and unknown ids are skipped. */
  async deleteMany(ids: string[]): Promise<{ deleted: string[]; skipped: string[] }> {
    const unique = [...new Set(ids)];
    const deleted = await this.repository.deleteFinished(unique);
    const done = new Set(deleted);
    return { deleted, skipped: unique.filter((id) => !done.has(id)) };
  }

  /** Deletes a finished run. Runs still in progress cannot be deleted. */
  async delete(id: string): Promise<void> {
    const run = await this.getById(id);
    if (ACTIVE_RUN_STATUSES.includes(run.status)) {
      throw new AppError(
        409,
        'RUN_IN_PROGRESS',
        'Wait for the run to finish before you delete it.',
      );
    }
    if (!(await this.repository.delete(id))) {
      throw new AppError(404, 'RUN_NOT_FOUND', 'Run not found');
    }
  }

  /** Resolves once every started run has finished. Used by tests and graceful shutdown. */
  async waitForIdle(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  /**
   * Never rejects: a detached promise that rejects would crash the process.
   * The outcome is stored last, after cleanup: once a run reads as finished, its slot is free.
   */
  private async execute(run: Run): Promise<void> {
    try {
      await this.repository.update(run.id, { status: 'running', startedAt: new Date() });
      await this.repository.update(run.id, await this.runInWorkDir(run));
    } catch (error) {
      await this.markError(run.id, error);
    } finally {
      this.stopRequested.delete(run.id);
      this.executing.delete(run.id);
    }
  }

  /** Runs k6 in a temporary directory, removed before this returns the outcome to store. */
  private async runInWorkDir(run: Run): Promise<Partial<NewRun>> {
    const workDir = await mkdtemp(join(tmpdir(), 'k6-run-'));
    try {
      const summaryPath = join(workDir, 'summary.json');
      const pointsPath = join(workDir, 'points.csv');
      // A file, not an env var: large flows would pass the OS limit for one env string.
      const flowPath = join(workDir, 'flow.json');
      await writeFile(flowPath, JSON.stringify(run.flow));
      const { exitCode, stderr } = await this.withLivePoints(run.id, pointsPath, () =>
        this.spawnK6(run, { summaryPath, pointsPath, flowPath }),
      );
      const summary = await readSummary(summaryPath);
      const stopped = this.stopRequested.has(run.id);
      if (!stopped && exitCode === K6_ABORTED_EXIT_CODE) {
        // The scenario aborted on a refused target: an error of the run, not a failed threshold.
        return {
          status: 'error',
          exitCode,
          summary,
          errorMessage: PRIVATE_TARGET_MESSAGE,
          finishedAt: new Date(),
        };
      }
      return {
        status: stopped ? 'stopped' : statusFromExitCode(exitCode),
        exitCode,
        summary,
        errorMessage:
          stopped || exitCode === 0 || exitCode === K6_THRESHOLD_FAILED_EXIT_CODE ? null : stderr,
        finishedAt: new Date(),
      };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /**
   * Stops a run in progress: SIGINT lets k6 end gracefully and keep partial results;
   * SIGKILL follows if it has not exited after the grace period.
   */
  async stop(id: string): Promise<Run> {
    const run = await this.getById(id);
    if (!ACTIVE_RUN_STATUSES.includes(run.status)) {
      throw new AppError(409, 'RUN_NOT_ACTIVE', 'This run has already finished.');
    }
    this.stopRequested.add(id);
    const child = this.processes.get(id);
    if (child) {
      child.kill('SIGINT');
      const timer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, STOP_GRACE_MS);
      child.once('close', () => clearTimeout(timer));
    } else if (!this.executing.has(id)) {
      // Not started by this process (left over from a restart): nothing to signal.
      await this.repository.update(id, { status: 'stopped', finishedAt: new Date() });
      this.stopRequested.delete(id);
    }
    return this.getById(id);
  }

  /** While `work` runs, turns new CSV rows into stored points every couple of seconds. */
  private async withLivePoints<Result>(
    runId: string,
    pointsPath: string,
    work: () => Promise<Result>,
  ): Promise<Result> {
    const tail = new FileTail(pointsPath);
    // k6 stamps samples with wall-clock seconds; second 0 is when k6 was started.
    const aggregator = new TimeseriesAggregator(Math.floor(Date.now() / 1000));
    // Points that failed to insert stay here and go out with the next flush.
    let pending: RunPointValues[] = [];
    let flushing = Promise.resolve();
    const flush = (all: boolean) => {
      // Recover first: one failed flush must not reject every later one.
      flushing = flushing
        .catch(() => undefined)
        .then(async () => {
          aggregator.consume(await tail.read());
          pending = [...pending, ...aggregator.drain(all)];
          await this.repository.addPoints(runId, pending);
          pending = [];
        });
      return flushing;
    };
    const timer = setInterval(() => {
      flush(false).catch((error: unknown) => console.error(`run ${runId} points flush`, error));
    }, POINTS_FLUSH_INTERVAL_MS);
    try {
      return await work();
    } finally {
      clearInterval(timer);
      await flush(true).catch((error: unknown) => console.error(`run ${runId} points`, error));
    }
  }

  private async markError(runId: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await this.repository.update(runId, {
        status: 'error',
        errorMessage,
        finishedAt: new Date(),
      });
    } catch (updateError) {
      console.error(`run ${runId} failed and could not be marked as error`, updateError);
    }
  }

  private spawnK6(
    run: Run,
    {
      summaryPath,
      pointsPath,
      flowPath,
    }: { summaryPath: string; pointsPath: string; flowPath: string },
  ): Promise<{ exitCode: number; stderr: string }> {
    const { thinkTimeSeconds, maxErrorRate, latencyLimitsMs } = run.limits;
    // Only what k6 needs: the child must not inherit DATABASE_URL or other secrets.
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      BASE_URL: run.baseUrl,
      STAGES: stagesToEnv(run.stages),
      FLOW_PATH: flowPath,
      THINK_TIME_SECONDS: String(thinkTimeSeconds),
      MAX_ERROR_RATE: String(maxErrorRate),
      P50_MS: String(latencyLimitsMs.p50),
      P90_MS: String(latencyLimitsMs.p90),
      P95_MS: String(latencyLimitsMs.p95),
      P99_MS: String(latencyLimitsMs.p99),
      // k6 checks every resolved address, so DNS cannot steer a run onto this network.
      ...(this.k6.allowPrivateTargets()
        ? {}
        : {
            K6_BLACKLIST_IPS: PRIVATE_IP_RANGES.join(','),
            K6_BLOCK_HOSTNAMES: PRIVATE_HOSTNAMES.join(','),
          }),
    };
    const bundle = join(this.k6.bundleDir, `${run.type}.js`);
    return new Promise((resolve, reject) => {
      const args = [
        'run',
        '--quiet',
        '--summary-export',
        summaryPath,
        '--out',
        `csv=${pointsPath}`,
        '--system-tags=',
        // Own REST API port per run (0 = any free one), so parallel runs never collide on 6565.
        '--address',
        'localhost:0',
        bundle,
      ];
      if (this.stopRequested.has(run.id)) {
        // Stopped while still queued: never start k6.
        resolve({ exitCode: -1, stderr: '' });
        return;
      }
      const child = spawn('k6', args, { env });
      this.processes.set(run.id, child);
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4000);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        this.processes.delete(run.id);
        resolve({ exitCode: code ?? -1, stderr: stderr.trim() });
      });
    });
  }
}

/** Replaces the values of secret headers in the run's flow; the stored row keeps them. */
function redactSecrets(run: Run): Run {
  const flow = run.flow.map((step) => ({
    ...step,
    headers: Object.fromEntries(
      Object.entries(step.headers).map(([name, value]) => [
        name,
        SECRET_HEADER_PATTERN.test(name) ? REDACTED : value,
      ]),
    ),
  }));
  return { ...run, flow };
}

function statusFromExitCode(exitCode: number): RunStatus {
  if (exitCode === 0) return 'passed';
  if (exitCode === K6_THRESHOLD_FAILED_EXIT_CODE) return 'failed';
  return 'error';
}

async function readSummary(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
