import { availableParallelism } from 'node:os';

// k6 docs ("Running large tests"): simple tests use about 1-5 MB per VU. We take 5 MB.
const MEMORY_PER_VIRTUAL_USER_BYTES = 5 * 1024 * 1024;
// Leave 20% of free memory for Postgres, the backend and the OS.
const MEMORY_HEADROOM = 0.8;

/** Rough VU estimate for this host, from free memory (respects container limits). */
export function hostCapacity() {
  const availableMemoryBytes = process.availableMemory();
  return {
    cpuCount: availableParallelism(),
    availableMemoryBytes,
    memoryPerVirtualUserBytes: MEMORY_PER_VIRTUAL_USER_BYTES,
    estimatedVirtualUsers: Math.floor(
      (availableMemoryBytes * MEMORY_HEADROOM) / MEMORY_PER_VIRTUAL_USER_BYTES,
    ),
  };
}
