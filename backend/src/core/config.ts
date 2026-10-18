// Only reader of process.env. Dev defaults match the local compose stack.
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url().default('postgres://perf:perf@localhost:10002/perf'),
    DEFAULT_BASE_URL: z.url().default('http://localhost:10001'),
    K6_BUNDLE_DIR: z.string().min(1).default('dist/k6'),
    /**
     * Lets runs target private, loopback and link-local addresses (see modules/runs/targets.ts).
     * Only the exact string `true` turns it on in production; unset or empty means on outside
     * production, where the target is the demo app on localhost.
     */
    ALLOW_PRIVATE_TARGETS: z.enum(['true', 'false', '']).optional(),
  })
  .transform((env) => ({
    ...env,
    allowPrivateTargets:
      env.ALLOW_PRIVATE_TARGETS === 'true' ||
      (!env.ALLOW_PRIVATE_TARGETS && env.NODE_ENV !== 'production'),
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
