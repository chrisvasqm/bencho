// Only reader of process.env. Dev defaults match the local compose stack.
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url().default('postgres://perf:perf@localhost:10002/perf'),
  // Integration tests create and drop one database per test file on this server.
  TEST_DATABASE_URL: z.url().default('postgres://perf:perf@localhost:10005/perf'),
  DEFAULT_BASE_URL: z.url().default('http://localhost:10001'),
  K6_BUNDLE_DIR: z.string().min(1).default('dist/k6'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment: ${names}`);
  }
  return parsed.data;
}
