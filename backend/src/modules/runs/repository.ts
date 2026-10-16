import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../core/db.ts';
import { runs, type NewRun, type Run } from './schema.ts';
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
}
