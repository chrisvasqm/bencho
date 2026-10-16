// Service layer: the only module that talks to the backend. Responses are parsed with Zod.
import { z } from 'zod';

export const RUN_TYPES = ['load', 'stress', 'spike'] as const;
export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = ['queued', 'running', 'passed', 'failed', 'error'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

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
  maxErrorRate: z.number(),
  latencyLimitsMs: latencyLimitsSchema,
});
export type RunLimits = z.infer<typeof limitsSchema>;

const trendSchema = z
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
        http_req_duration: trendSchema.optional(),
        http_req_failed: z
          .object({ value: z.number(), passes: z.number(), fails: z.number() })
          .optional(),
        http_reqs: z.object({ count: z.number(), rate: z.number() }).optional(),
      })
      .loose(),
  })
  .loose();
export type RunSummary = z.infer<typeof summarySchema>;

const runSchema = z.object({
  id: z.string(),
  type: z.enum(RUN_TYPES),
  baseUrl: z.string(),
  stages: z.array(stageSchema),
  limits: limitsSchema,
  status: z.enum(RUN_STATUSES),
  exitCode: z.number().nullable(),
  summary: summarySchema.nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});
export type Run = z.infer<typeof runSchema>;

const defaultsSchema = z.object({
  baseUrl: z.string(),
  stages: z.record(z.enum(RUN_TYPES), z.array(stageSchema)),
  limits: limitsSchema,
});
export type RunDefaults = z.infer<typeof defaultsSchema>;

export interface CreateRunInput {
  type: RunType;
  baseUrl: string;
  stages: Stage[];
  thinkTimeSeconds: number;
  maxErrorRate: number;
  latencyLimitsMs: LatencyLimitsMs;
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
  list: (type: RunType) => request(`/runs?type=${type}`, z.object({ runs: z.array(runSchema) })),
  get: (id: string) => request(`/runs/${id}`, z.object({ run: runSchema })),
  create: (input: CreateRunInput) =>
    request('/runs', z.object({ run: runSchema }), { method: 'POST', body: JSON.stringify(input) }),
};
