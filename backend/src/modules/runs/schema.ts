import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  DURATION_PATTERN,
  RUN_TYPES,
  durationToSeconds,
  type LoadStage,
  type RunLimits,
  type RunType,
} from '../../../k6/lib/defaults.ts';
import {
  BUILTIN_PLACEHOLDERS,
  DEFAULT_FLOW,
  HTTP_METHODS,
  MAX_BODY_LENGTH,
  MAX_EXTRACTS,
  MAX_HEADERS,
  MAX_HEADER_VALUE_LENGTH,
  MAX_STEPS,
  MAX_STEP_NAME_LENGTH,
  MAX_WAIT_SECONDS,
  PLACEHOLDER_NAME_PATTERN,
  flowProblem,
  hasPlaceholderHost,
  isFullUrl,
  type FlowStep,
} from '../../../k6/lib/flow.ts';

/** Credentials belong in a header (returned redacted), never in a URL that every reader sees. */
const hasNoCredentials = (url: string) => {
  // Zod runs every refinement: a URL that does not parse is reported by the format check.
  if (!URL.canParse(url)) return true;
  const parsed = new URL(url);
  return parsed.username === '' && parsed.password === '';
};
const NO_CREDENTIALS_MESSAGE = 'Put credentials in a header, not in the URL';
/** A step path that is a URL with a literal host, so it can be parsed and checked now. */
const isCheckableUrl = (path: string) => isFullUrl(path) && !hasPlaceholderHost(path);

export const RUN_STATUSES = ['queued', 'running', 'passed', 'failed', 'error', 'stopped'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
/** Statuses of a run that has not finished yet. */
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ['queued', 'running'];

export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').$type<RunType>().notNull(),
    baseUrl: text('base_url').notNull(),
    stages: jsonb('stages').$type<LoadStage[]>().notNull(),
    limits: jsonb('limits').$type<RunLimits>().notNull(),
    flow: jsonb('flow').$type<FlowStep[]>().notNull().default(DEFAULT_FLOW),
    status: text('status').$type<RunStatus>().notNull().default('queued'),
    exitCode: integer('exit_code'),
    summary: jsonb('summary').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    // The list query filters by type and pages newest first.
    index('runs_type_created_at_idx').on(table.type, table.createdAt.desc()),
    // The active-runs poll (every 2 s while runs are going) reads only queued and running rows.
    index('runs_active_created_at_idx')
      .on(table.createdAt.desc())
      .where(
        // Drizzle Kit cannot inline bound parameters in an index predicate; write literals.
        sql`${table.status} in (${sql.raw(ACTIVE_RUN_STATUSES.map((status) => `'${status}'`).join(', '))})`,
      ),
  ],
);

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

const placeholderName = z
  .string()
  .regex(PLACEHOLDER_NAME_PATTERN, 'Use letters, digits and _, not starting with a digit')
  .refine((name) => !(BUILTIN_PLACEHOLDERS as readonly string[]).includes(name), {
    message: 'This name is built in',
  });

const flowStepSchema = z.object({
  name: z.string().trim().min(1).max(MAX_STEP_NAME_LENGTH),
  method: z.enum(HTTP_METHODS),
  path: z
    .string()
    .max(2000)
    .refine((path) => !isCheckableUrl(path) || URL.canParse(path), 'Invalid URL')
    .refine((path) => !isCheckableUrl(path) || hasNoCredentials(path), NO_CREDENTIALS_MESSAGE),
  headers: z
    .record(
      z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, 'Invalid header name'),
      z
        .string()
        .max(MAX_HEADER_VALUE_LENGTH)
        .regex(/^[^\r\n]*$/, 'Header values cannot contain line breaks'),
    )
    .refine((headers) => Object.keys(headers).length <= MAX_HEADERS, {
      message: `Use at most ${MAX_HEADERS} headers`,
    }),
  body: z.string().max(MAX_BODY_LENGTH).nullable(),
  expectedStatus: z.number().int().min(100).max(599),
  extract: z
    .array(z.object({ name: placeholderName, path: z.string().trim().min(1).max(200) }))
    .max(MAX_EXTRACTS),
  wait: z
    .object({
      minSeconds: z.number().min(0).max(MAX_WAIT_SECONDS),
      maxSeconds: z.number().min(0).max(MAX_WAIT_SECONDS),
    })
    .optional(),
});

const flowSchema = z
  .array(flowStepSchema)
  .min(1)
  .max(MAX_STEPS)
  .superRefine((steps, context) => {
    const problem = flowProblem(steps);
    if (problem) context.addIssue({ code: 'custom', message: problem });
  });

export const createRunSchema = z.object({
  type: z.enum(RUN_TYPES),
  baseUrl: z.url({ protocol: /^https?$/ }).refine(hasNoCredentials, NO_CREDENTIALS_MESSAGE),
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
  flow: flowSchema.optional(),
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
