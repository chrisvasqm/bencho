// Turns k6's CSV output (one row per sample) into one point per second while the run is going.
// Feed it chunks as the file grows; it keeps the partial last line and only finalizes seconds
// old enough that no more samples can arrive for them.
import { open } from 'node:fs/promises';

export interface RunPointValues {
  second: number;
  virtualUsers: number;
  requestsPerSecond: number;
  /** Flow runs (k6 iterations) that finished in this second. */
  iterationsPerSecond: number;
  /** Rate runs only: flow runs k6 skipped in this second because every allowed VU was busy. */
  droppedPerSecond: number;
  errorRate: number;
  p50: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
}

interface Bucket {
  durations: number[];
  requests: number;
  iterations: number;
  dropped: number;
  failed: number;
  failedSamples: number;
  virtualUsers: number;
  sawVirtualUsers: boolean;
}

// k6 flushes CSV rows in batches about a second apart; wait this long before closing a second.
// Samples that still arrive later for a closed second are dropped (never counted twice).
const SETTLE_SECONDS = 5;

function percentile(sorted: number[], fraction: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? null;
}

export class TimeseriesAggregator {
  private readonly buckets = new Map<number, Bucket>();
  private remainder = '';
  private latestSecond = 0;
  private lastVirtualUsers = 0;
  private closedUpTo = Number.NEGATIVE_INFINITY;
  /**
   * Unix second of k6's first sample: point second 0 is when the test itself started, after k6
   * loaded the script and created its VUs, so the points line up with the planned stages.
   */
  private startSecond: number | undefined;

  /** Adds raw CSV text. Lines may be split across chunks. */
  consume(chunk: string): void {
    const lines = (this.remainder + chunk).split('\n');
    this.remainder = lines.pop() ?? '';
    for (const line of lines) this.consumeLine(line);
  }

  /** Returns and forgets every complete second. `all` also flushes the most recent ones (run over). */
  drain(all = false): RunPointValues[] {
    if (all && this.remainder) {
      this.consumeLine(this.remainder);
      this.remainder = '';
    }
    const cutoff = all ? Infinity : this.latestSecond - SETTLE_SECONDS;
    const ready = [...this.buckets.keys()]
      .filter((second) => second <= cutoff)
      .sort((a, b) => a - b);
    const last = ready.at(-1);
    if (last !== undefined) this.closedUpTo = Math.max(this.closedUpTo, last);
    return ready.map((second) => {
      const bucket = this.buckets.get(second)!;
      this.buckets.delete(second);
      // A second with no vus sample keeps the last known count; a real 0 stays 0.
      if (bucket.sawVirtualUsers) this.lastVirtualUsers = bucket.virtualUsers;
      const sorted = bucket.durations.sort((a, b) => a - b);
      return {
        second: Math.max(0, second - (this.startSecond ?? second)),
        virtualUsers: this.lastVirtualUsers,
        requestsPerSecond: bucket.requests,
        iterationsPerSecond: bucket.iterations,
        droppedPerSecond: bucket.dropped,
        errorRate: bucket.failedSamples ? bucket.failed / bucket.failedSamples : 0,
        p50: percentile(sorted, 0.5),
        p90: percentile(sorted, 0.9),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
      };
    });
  }

  private consumeLine(line: string): void {
    const [metric, timestamp, rawValue] = line.split(',', 3);
    const second = Number(timestamp);
    const value = Number(rawValue);
    if (!metric || !Number.isFinite(second) || !Number.isFinite(value)) return; // header or junk
    if (second <= this.closedUpTo) return; // too late: that second is already stored
    this.startSecond ??= second;
    this.latestSecond = Math.max(this.latestSecond, second);
    const bucket = this.bucketFor(second);
    if (metric === 'http_req_duration') bucket.durations.push(value);
    else if (metric === 'http_reqs') bucket.requests += value;
    else if (metric === 'iterations') bucket.iterations += value;
    else if (metric === 'dropped_iterations') bucket.dropped += value;
    else if (metric === 'vus') {
      bucket.virtualUsers = bucket.sawVirtualUsers ? Math.max(bucket.virtualUsers, value) : value;
      bucket.sawVirtualUsers = true;
    } else if (metric === 'http_req_failed') {
      bucket.failed += value;
      bucket.failedSamples += 1;
    }
  }

  private bucketFor(second: number): Bucket {
    let bucket = this.buckets.get(second);
    if (!bucket) {
      bucket = {
        durations: [],
        requests: 0,
        iterations: 0,
        dropped: 0,
        failed: 0,
        failedSamples: 0,
        virtualUsers: 0,
        sawVirtualUsers: false,
      };
      this.buckets.set(second, bucket);
    }
    return bucket;
  }
}

/** Reads what was appended to a file since the last call. Missing file = nothing yet. */
export class FileTail {
  private offset = 0;

  constructor(private readonly path: string) {}

  async read(): Promise<string> {
    let handle;
    try {
      handle = await open(this.path, 'r');
    } catch {
      return '';
    }
    try {
      const { size } = await handle.stat();
      if (size <= this.offset) return '';
      const buffer = Buffer.alloc(size - this.offset);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, this.offset);
      this.offset += bytesRead;
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  }
}
