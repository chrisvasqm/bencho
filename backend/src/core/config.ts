// Only reader of process.env. Dev defaults match the local compose stack.
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url().default('postgres://perf:perf@localhost:10002/perf'),
    DEFAULT_BASE_URL: z.url().default('http://localhost:10001'),
    /** Base URL of the SOAP demo app (Learn Web Services) that the SOAP example flow calls. */
    SOAP_EXAMPLE_BASE_URL: z.url().default('http://localhost:10006'),
    K6_BUNDLE_DIR: z.string().min(1).default('dist/k6'),
    /**
     * Lets runs target private, loopback and link-local addresses (see modules/runs/targets.ts).
     * Allowed unless set to the exact string `false` (docs/decisions/2026-10-18-private-targets-
     * allowed-by-default.md). `true` and empty allow; any other value is a startup error.
     */
    ALLOW_PRIVATE_TARGETS: z.enum(['true', 'false', '']).optional(),
  })
  .transform((env) => ({
    ...env,
    allowPrivateTargets: env.ALLOW_PRIVATE_TARGETS !== 'false',
  }));

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment: ${names}`);
  }
  return parsed.data;
}
