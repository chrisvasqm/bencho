// Service layer: the only module that talks to the backend. Responses are parsed with Zod.
import { z } from 'zod';

export const RUN_TYPES = ['load', 'stress', 'spike'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = ['queued', 'running', 'passed', 'failed', 'error', 'stopped'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const LOAD_MODES = ['users', 'rate'] as const;
export type LoadMode = (typeof LOAD_MODES)[number];

const stageSchema = z.object({ duration: z.string(), target: z.number() });
export type Stage = z.infer<typeof stageSchema>;

const latencyLimitsSchema = z.object({
  p50: z.number(),
  p90: z.number(),
  p95: z.number(),
  p99: z.number(),
});
export type LatencyLimitsMs = z.infer<typeof latencyLimitsSchema>;

const limitsSchema = z.object({
  thinkTimeSeconds: z.number(),
  // Runs stored before the setting existed ran with k6's default of 30 s.
  gracePeriodSeconds: z.number().default(30),
  maxErrorRate: z.number(),
  latencyLimitsMs: latencyLimitsSchema,
  // Runs stored before the setting existed ran to the end.
  stopOnLimit: z.boolean().default(false),
});
export type RunLimits = z.infer<typeof limitsSchema>;

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
export const BODY_FORMATS = ['json', 'soap'] as const;
export type BodyFormat = (typeof BODY_FORMATS)[number];

const flowStepSchema = z.object({
  name: z.string(),
  method: z.enum(HTTP_METHODS),
  path: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string().nullable(),
  /** Without it the step sends JSON and reads JSON paths. */
  bodyFormat: z.enum(BODY_FORMATS).optional(),
  expectedStatus: z.number(),
  extract: z.array(z.object({ name: z.string(), path: z.string() })),
  wait: z.object({ minSeconds: z.number(), maxSeconds: z.number() }).optional(),
});
export type FlowStep = z.infer<typeof flowStepSchema>;

const k6TrendSchema = z
  .object({
    avg: z.number(),
    min: z.number(),
    med: z.number(),
    max: z.number(),
    'p(90)': z.number(),
    'p(95)': z.number(),
    'p(99)': z.number(),
  })
  .partial();

const summarySchema = z
  .object({
    metrics: z
      .object({
        http_req_duration: k6TrendSchema.optional(),
        http_req_failed: z
          .object({ value: z.number(), passes: z.number(), fails: z.number() })
          .optional(),
        http_reqs: z.object({ count: z.number(), rate: z.number() }).optional(),
        // Share of steps that got their expected status and saved their values (k6 checks).
        checks: z.object({ value: z.number(), passes: z.number(), fails: z.number() }).optional(),
        // Rate runs only: flow runs k6 skipped because every allowed VU was busy.
        dropped_iterations: z.object({ count: z.number() }).optional(),
      })
      .loose(),
  })
  .loose();
export type RunSummary = z.infer<typeof summarySchema>;

const failureSchema = z.object({
  step: z.string(),
  reason: z.enum(['status', 'extract']),
  status: z.number(),
  body: z.string(),
});
export type FailureSample = z.infer<typeof failureSchema>;

const runSchema = z.object({
  id: z.string(),
  type: z.enum(RUN_TYPES),
  baseUrl: z.string(),
  mode: z.enum(LOAD_MODES),
  stages: z.array(stageSchema),
  maxVirtualUsers: z.number().nullable(),
  limits: limitsSchema,
  flow: z.array(flowStepSchema),
  status: z.enum(RUN_STATUSES),
  exitCode: z.number().nullable(),
  summary: summarySchema.nullable(),
  // Only GET /runs/:id returns failures; list items do not carry them.
  failures: z.array(failureSchema).default([]),
  errorMessage: z.string().nullable(),
  // Runs stored before the setting existed ran to the end.
  stoppedEarly: z.boolean().default(false),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type Run = z.infer<typeof runSchema>;

const pointSchema = z.object({
  second: z.number(),
  virtualUsers: z.number(),
  // Defaults keep the client working against a backend without these fields.
  iterationsPerSecond: z.number().default(0),
  droppedPerSecond: z.number().default(0),
  requestsPerSecond: z.number(),
  errorRate: z.number(),
  p50: z.number().nullable(),
  p90: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
});
export type RunPoint = z.infer<typeof pointSchema>;

const runsPageSchema = z.object({
  runs: z.array(runSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type RunsPage = z.infer<typeof runsPageSchema>;

const defaultsSchema = z.object({
  baseUrl: z.string(),
  /** Target of the SOAP example flow; a backend without it offers no SOAP example. */
  soapExampleBaseUrl: z.string().optional(),
  stages: z.record(z.enum(RUN_TYPES), z.array(stageSchema)),
  maxVirtualUsers: z.number(),
  limits: limitsSchema.omit({ stopOnLimit: true }),
  /** Per type: whether a broken limit ends the run early. */
  stopOnLimit: z.record(z.enum(RUN_TYPES), z.boolean()),
  /** Seconds before a broken limit can end the run. */
  stopOnLimitDelaySeconds: z.number(),
  flow: z.array(flowStepSchema),
});
export type RunDefaults = z.infer<typeof defaultsSchema>;

const capacitySchema = z.object({
  cpuCount: z.number().int().positive(),
  availableMemoryBytes: z.number().nonnegative(),
  memoryPerVirtualUserBytes: z.number().positive(),
  estimatedVirtualUsers: z.number().int().nonnegative(),
});
export type Capacity = z.infer<typeof capacitySchema>;

export interface CreateRunInput {
  type: RunType;
  baseUrl: string;
  mode: LoadMode;
  stages: Stage[];
  /** Rate runs only. */
  maxVirtualUsers?: number;
  flow: FlowStep[];
  thinkTimeSeconds: number;
  gracePeriodSeconds: number;
  maxErrorRate: number;
  latencyLimitsMs: LatencyLimitsMs;
  stopOnLimit: boolean;
}

export interface RunListFilters {
  type?: RunType;
  /** ISO 8601 instants: created at or after `from` and before `to` (a half-open range). */
  from?: string;
  to?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
  }
}

const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown() }),
});

async function request<Output>(path: string, schema: z.ZodType<Output>, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.status === 204) return schema.parse(undefined);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = errorBodySchema.safeParse(body);
    const error = parsed.success
      ? parsed.data.error
      : { code: 'UNKNOWN', message: 'Request failed', details: null };
    throw new ApiError(response.status, error.code, error.message, error.details);
  }
  return schema.parse(body);
}

export const runsApi = {
  defaults: () => request('/defaults', defaultsSchema),
  capacity: () => request('/capacity', capacitySchema),
  /** Newest first; every type unless `type` is given, within [from, to] when they are given. */
  list: (page: number, pageSize: number, filters: RunListFilters = {}) => {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.type) query.set('type', filters.type);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    return request(`/runs?${query.toString()}`, runsPageSchema);
  },
  active: () => request('/runs?active=true&pageSize=10', runsPageSchema),
  points: (id: string) => request(`/runs/${id}/points`, z.object({ points: z.array(pointSchema) })),
  remove: (id: string) => request(`/runs/${id}`, z.undefined(), { method: 'DELETE' }),
  stop: (id: string) =>
    request(`/runs/${id}/stop`, z.object({ run: runSchema }), { method: 'POST' }),
  removeMany: (ids: string[]) =>
    request(
      '/runs/delete',
      z.object({ deleted: z.array(z.string()), skipped: z.array(z.string()) }),
      {
        method: 'POST',
        body: JSON.stringify({ ids }),
      },
    ),
  get: (id: string) => request(`/runs/${id}`, z.object({ run: runSchema })),
  create: (input: CreateRunInput) =>
    request('/runs', z.object({ run: runSchema }), { method: 'POST', body: JSON.stringify(input) }),
};
