import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
  DURATION_PATTERN,
  RUN_TYPES,
  durationToSeconds,
  type LoadStage,
  type RunLimits,
  type RunType,
} from '../../../k6/lib/defaults.ts';

export const RUN_STATUSES = ['queued', 'running', 'passed', 'failed', 'error', 'stopped'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').$type<RunType>().notNull(),
  baseUrl: text('base_url').notNull(),
  stages: jsonb('stages').$type<LoadStage[]>().notNull(),
  limits: jsonb('limits').$type<RunLimits>().notNull(),
  status: text('status').$type<RunStatus>().notNull().default('queued'),
  exitCode: integer('exit_code'),
  summary: jsonb('summary').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export type Run = typeof runs.$inferSelect;

/** One point per second of a run, built from k6's CSV output. */
export const runPoints = pgTable(
  'run_points',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    second: integer('second').notNull(),
    virtualUsers: integer('virtual_users').notNull(),
    requestsPerSecond: integer('requests_per_second').notNull(),
    errorRate: doublePrecision('error_rate').notNull(),
    p50: doublePrecision('p50'),
    p90: doublePrecision('p90'),
    p95: doublePrecision('p95'),
    p99: doublePrecision('p99'),
  },
  (table) => [primaryKey({ columns: [table.runId, table.second] })],
);
export type RunPoint = typeof runPoints.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export const MAX_VIRTUAL_USERS = 1000;
export const MAX_STAGES = 20;
export const MAX_RUN_SECONDS = 3600;

const stageSchema = z.object({
  duration: z.string().regex(DURATION_PATTERN, 'Use a k6 duration such as 30s or 1m'),
  target: z.number().int().min(0).max(MAX_VIRTUAL_USERS),
});

const positiveMs = z.number().int().positive();

export const createRunSchema = z.object({
  type: z.enum(RUN_TYPES),
  baseUrl: z.url(),
  stages: z
    .array(stageSchema)
    .min(1)
    .max(MAX_STAGES)
    .refine(
      (stages) =>
        stages.reduce((total, stage) => total + durationToSeconds(stage.duration), 0) <=
        MAX_RUN_SECONDS,
      { message: `All stages together must last at most ${MAX_RUN_SECONDS / 60} minutes` },
    )
    .optional(),
  thinkTimeSeconds: z.number().min(0).optional(),
  maxErrorRate: z.number().min(0).max(1).optional(),
  latencyLimitsMs: z
    .object({ p50: positiveMs, p90: positiveMs, p95: positiveMs, p99: positiveMs })
    .optional(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const listRunsQuerySchema = z.object({
  type: z.enum(RUN_TYPES).optional(),
  /** Only runs still queued or running, across types when `type` is not given. */
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export const runIdParamsSchema = z.object({ id: z.uuid() });

export const MAX_BULK_DELETE = 50;
export const bulkDeleteSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_BULK_DELETE),
});
