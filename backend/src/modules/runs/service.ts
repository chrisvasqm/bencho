// Starts k6 runs as child processes and records their outcome.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from '../../core/errors.ts';
import { DEFAULT_LIMITS, DEFAULT_STAGES, stagesToEnv } from '../../../k6/lib/defaults.ts';
import type { RunType } from '../../../k6/lib/defaults.ts';
import type { RunsRepository } from './repository.ts';
import { FileTail, TimeseriesAggregator } from './timeseries.ts';
import type { CreateRunInput, Run, RunPoint, RunStatus } from './schema.ts';

const K6_THRESHOLD_FAILED_EXIT_CODE = 99;
const MAX_CONCURRENT_RUNS = 3;
const POINTS_FLUSH_INTERVAL_MS = 2000;

export interface K6Settings {
  bundleDir: string;
  defaultBaseUrl: string;
}

export class RunsService {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly repository: RunsRepository,
    private readonly k6: K6Settings,
  ) {}

  defaults() {
    return { baseUrl: this.k6.defaultBaseUrl, stages: DEFAULT_STAGES, limits: DEFAULT_LIMITS };
  }

  /** Stores the run as queued and starts k6 in the background. Poll getById for the outcome. */
  async start(input: CreateRunInput): Promise<Run> {
    if (this.inFlight.size >= MAX_CONCURRENT_RUNS) {
      throw new AppError(
        409,
        'TOO_MANY_RUNS',
        `At most ${MAX_CONCURRENT_RUNS} runs can be in progress. Wait for one to finish.`,
      );
    }
    const run = await this.repository.create({
      type: input.type,
      baseUrl: input.baseUrl,
      stages: input.stages ?? DEFAULT_STAGES[input.type],
      limits: {
        thinkTimeSeconds: input.thinkTimeSeconds ?? DEFAULT_LIMITS.thinkTimeSeconds,
        maxErrorRate: input.maxErrorRate ?? DEFAULT_LIMITS.maxErrorRate,
        latencyLimitsMs: input.latencyLimitsMs ?? DEFAULT_LIMITS.latencyLimitsMs,
      },
    });
    const execution = this.execute(run).finally(() => this.inFlight.delete(execution));
    this.inFlight.add(execution);
    return run;
  }

  async getById(id: string): Promise<Run> {
    const run = await this.repository.findById(id);
    if (!run) throw new AppError(404, 'RUN_NOT_FOUND', 'Run not found');
    return run;
  }

  async listPoints(id: string): Promise<RunPoint[]> {
    await this.getById(id);
    return this.repository.listPoints(id);
  }

  /** Call once at startup, before accepting runs. */
  async failUnfinishedRuns(): Promise<number> {
    return this.repository.failUnfinished('The backend restarted while this run was in progress.');
  }

  list(type?: RunType): Promise<Run[]> {
    return this.repository.list(type);
  }

  /** Resolves once every started run has finished. Used by tests and graceful shutdown. */
  async waitForIdle(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  /** Never rejects: a detached promise that rejects would crash the process. */
  private async execute(run: Run): Promise<void> {
    let workDir: string | undefined;
    try {
      await this.repository.update(run.id, { status: 'running', startedAt: new Date() });
      workDir = await mkdtemp(join(tmpdir(), 'k6-run-'));
      const summaryPath = join(workDir, 'summary.json');
      const pointsPath = join(workDir, 'points.csv');
      const { exitCode, stderr } = await this.withLivePoints(run.id, pointsPath, () =>
        this.spawnK6(run, summaryPath, pointsPath),
      );
      const summary = await readSummary(summaryPath);
      await this.repository.update(run.id, {
        status: statusFromExitCode(exitCode),
        exitCode,
        summary,
        errorMessage: exitCode === 0 || exitCode === K6_THRESHOLD_FAILED_EXIT_CODE ? null : stderr,
        finishedAt: new Date(),
      });
    } catch (error) {
      await this.markError(run.id, error);
    } finally {
      if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** While `work` runs, turns new CSV rows into stored points every couple of seconds. */
  private async withLivePoints<Result>(
    runId: string,
    pointsPath: string,
    work: () => Promise<Result>,
  ): Promise<Result> {
    const tail = new FileTail(pointsPath);
    const aggregator = new TimeseriesAggregator();
    let flushing = Promise.resolve();
    const flush = (all: boolean) => {
      flushing = flushing.then(async () => {
        aggregator.consume(await tail.read());
        await this.repository.addPoints(runId, aggregator.drain(all));
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
    summaryPath: string,
    pointsPath: string,
  ): Promise<{ exitCode: number; stderr: string }> {
    const { thinkTimeSeconds, maxErrorRate, latencyLimitsMs } = run.limits;
    // Only what k6 needs: the child must not inherit DATABASE_URL or other secrets.
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      BASE_URL: run.baseUrl,
      STAGES: stagesToEnv(run.stages),
      THINK_TIME_SECONDS: String(thinkTimeSeconds),
      MAX_ERROR_RATE: String(maxErrorRate),
      P50_MS: String(latencyLimitsMs.p50),
      P90_MS: String(latencyLimitsMs.p90),
      P95_MS: String(latencyLimitsMs.p95),
      P99_MS: String(latencyLimitsMs.p99),
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
      const child = spawn('k6', args, { env });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4000);
      });
      child.on('error', reject);
      child.on('close', (code) => resolve({ exitCode: code ?? -1, stderr: stderr.trim() }));
    });
  }
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
