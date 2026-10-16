// Chart series shared by the run charts and the trend. Keep each percentile on the same slot.
export const LATENCY_SERIES = [
  { key: 'p50', label: 'p50', color: 'var(--series-1)' },
  { key: 'p90', label: 'p90', color: 'var(--series-2)' },
  // Dashes keep p95 apart from p90 and p99 apart from p50 under color-vision deficiency.
  { key: 'p95', label: 'p95', color: 'var(--series-3)', dash: '6 3' },
  { key: 'p99', label: 'p99', color: 'var(--series-4)', dash: '2 3' },
] as const;
