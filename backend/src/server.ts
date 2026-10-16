import { createApp } from './app.ts';
import { loadConfig } from './core/config.ts';
import { connectDatabase, runMigrations } from './core/db.ts';
import { RunsRepository } from './modules/runs/repository.ts';
import { RunsService } from './modules/runs/service.ts';

const config = loadConfig();
await runMigrations(config.DATABASE_URL);
const { db } = connectDatabase(config.DATABASE_URL);
const runsService = new RunsService(new RunsRepository(db), {
  bundleDir: config.K6_BUNDLE_DIR,
  defaultBaseUrl: config.DEFAULT_BASE_URL,
});

createApp(runsService).listen(config.PORT, () => {
  console.log(`backend listening on :${config.PORT} (${config.NODE_ENV})`);
});
