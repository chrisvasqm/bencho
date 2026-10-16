import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../core/db.ts';
import { runPoints, runs, type NewRun, type Run, type RunPoint } from './schema.ts';
import type { RunPointValues } from './timeseries.ts';
import type { RunType } from '../../../k6/lib/defaults.ts';

export class RunsRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewRun): Promise<Run> {
    const [created] = await this.db.insert(runs).values(input).returning();
    if (!created) throw new Error('Insert returned no row');
    return created;
  }

  findById(id: string): Promise<Run | undefined> {
    return this.db.query.runs.findFirst({ where: eq(runs.id, id) });
  }

  list(type?: RunType): Promise<Run[]> {
    return this.db.query.runs.findMany({
      where: type ? eq(runs.type, type) : undefined,
      orderBy: desc(runs.createdAt),
      limit: 100,
    });
  }

  async update(id: string, patch: Partial<NewRun>): Promise<void> {
    await this.db.update(runs).set(patch).where(eq(runs.id, id));
  }

  async addPoints(runId: string, points: RunPointValues[]): Promise<void> {
    if (points.length === 0) return;
    await this.db
      .insert(runPoints)
      .values(points.map((point) => ({ ...point, runId })))
      .onConflictDoNothing();
  }

  listPoints(runId: string): Promise<RunPoint[]> {
    return this.db.query.runPoints.findMany({
      where: eq(runPoints.runId, runId),
      orderBy: asc(runPoints.second),
    });
  }

  /** Runs left queued or running by a previous process can never finish; mark them as errors. */
  async failUnfinished(message: string): Promise<number> {
    const stale = await this.db
      .update(runs)
      .set({ status: 'error', errorMessage: message, finishedAt: new Date() })
      .where(inArray(runs.status, ['queued', 'running']))
      .returning({ id: runs.id });
    return stale.length;
  }
}
