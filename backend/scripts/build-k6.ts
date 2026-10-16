// Bundles each test with its lib/ imports into dist/<name>.js for k6. k6 modules stay external.
import { build } from 'esbuild';

await build({
  entryPoints: ['k6/*.ts'],
  outdir: 'dist/k6',
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  external: ['k6', 'k6/*'],
  logLevel: 'warning',
});
