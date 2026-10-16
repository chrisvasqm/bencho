// Settings only the tests read. Kept out of the app config so production never carries them.
import { z } from 'zod';

const schema = z.object({
  // Same var compose uses to publish postgres-test, so a moved port moves both.
  POSTGRES_TEST_PORT: z.coerce.number().int().positive().default(10005),
  TEST_DATABASE_URL: z.url().optional(),
});

/** Server the tests create and drop their throwaway databases on. */
export function testDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = schema.parse(env);
  return (
    parsed.TEST_DATABASE_URL ?? `postgres://perf:perf@localhost:${parsed.POSTGRES_TEST_PORT}/perf`
  );
}
