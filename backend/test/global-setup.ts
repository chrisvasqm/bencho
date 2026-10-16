// The lifecycle tests run the real k6 bundles, so build them before any test file starts.
export default async function setup(): Promise<void> {
  await import('../scripts/build-k6.ts');
}
