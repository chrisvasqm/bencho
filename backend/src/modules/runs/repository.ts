import { and, asc, count, desc, eq, inArray, notInArray } from 'drizzle-orm';
import type { Database } from '../../core/db.ts';
import {
  ACTIVE_RUN_STATUSES,
  runPoints,
  runs,
  type NewRun,
  type Run,
  type RunPoint,
} from './schema.ts';
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

  async listPage(
    type: RunType | undefined,
    active: boolean,
    page: number,
    pageSize: number,
  ): Promise<{ runs: Run[]; total: number }> {
    const where = and(
      type ? eq(runs.type, type) : undefined,
      active ? inArray(runs.status, [...ACTIVE_RUN_STATUSES]) : undefined,
    );
    const [rows, [totals]] = await Promise.all([
      this.db.query.runs.findMany({
        where,
        orderBy: desc(runs.createdAt),
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      this.db.select({ total: count() }).from(runs).where(where),
    ]);
    return { runs: rows, total: totals?.total ?? 0 };
  }

  /** Deletes the finished runs among `ids` (cascade removes points). Returns the deleted ids. */
  async deleteFinished(ids: string[]): Promise<string[]> {
    const deleted = await this.db
      .delete(runs)
      .where(and(inArray(runs.id, ids), notInArray(runs.status, [...ACTIVE_RUN_STATUSES])))
      .returning({ id: runs.id });
    return deleted.map((row) => row.id);
  }

  /** Deletes the run and, by cascade, its points. Returns false when no row matched. */
  async delete(id: string): Promise<boolean> {
    const deleted = await this.db.delete(runs).where(eq(runs.id, id)).returning({ id: runs.id });
    return deleted.length > 0;
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
      .where(inArray(runs.status, [...ACTIVE_RUN_STATUSES]))
      .returning({ id: runs.id });
    return stale.length;
  }
}
