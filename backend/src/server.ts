import { createApp } from './app.ts';
import { loadConfig } from './core/config.ts';
import { connectDatabase, pingDatabase, runMigrations } from './core/db.ts';
import { RunsRepository } from './modules/runs/repository.ts';
import { RunsService } from './modules/runs/service.ts';

const config = loadConfig();
await runMigrations(config.DATABASE_URL);
const { db } = connectDatabase(config.DATABASE_URL);
const runsService = new RunsService(new RunsRepository(db), {
  bundleDir: config.K6_BUNDLE_DIR,
  defaultBaseUrl: config.DEFAULT_BASE_URL,
  allowPrivateTargets: config.allowPrivateTargets,
});
if (config.allowPrivateTargets) console.log('private and local targets are allowed');

const staleRuns = await runsService.failUnfinishedRuns();
if (staleRuns > 0)
  console.log(`marked ${staleRuns} unfinished run(s) from a previous start as error`);

createApp({ runsService, checkDatabase: () => pingDatabase(db) }).listen(config.PORT, () => {
  console.log(`backend listening on :${config.PORT} (${config.NODE_ENV})`);
});
