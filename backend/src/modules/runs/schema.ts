import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import {
  DURATION_PATTERN,
  RUN_TYPES,
  type LoadStage,
  type RunLimits,
  type RunType,
} from '../../../k6/lib/defaults.ts';

export const RUN_STATUSES = ['queued', 'running', 'passed', 'failed', 'error'] as const;
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
export type NewRun = typeof runs.$inferInsert;

export const MAX_VIRTUAL_USERS = 1000;
export const MAX_STAGES = 20;

const stageSchema = z.object({
  duration: z.string().regex(DURATION_PATTERN, 'Use a k6 duration such as 30s or 1m'),
  target: z.number().int().min(0).max(MAX_VIRTUAL_USERS),
});

const positiveMs = z.number().int().positive();

export const createRunSchema = z.object({
  type: z.enum(RUN_TYPES),
  baseUrl: z.url(),
  stages: z.array(stageSchema).min(1).max(MAX_STAGES).optional(),
  thinkTimeSeconds: z.number().min(0).optional(),
  maxErrorRate: z.number().min(0).max(1).optional(),
  latencyLimitsMs: z
    .object({ p50: positiveMs, p90: positiveMs, p95: positiveMs, p99: positiveMs })
    .optional(),
});
export type CreateRunInput = z.infer<typeof createRunSchema>;

export const listRunsQuerySchema = z.object({ type: z.enum(RUN_TYPES).optional() });
export const runIdParamsSchema = z.object({ id: z.uuid() });
