// Reads the failure samples k6 writes to its console output (see k6/lib/failures.ts).
import { open } from 'node:fs/promises';
import {
  FAILURE_LOG_PREFIX,
  MAX_BODIES_PER_STATUS,
  MAX_FAILURES_PER_STEP,
  type FailureSample,
} from '../../../k6/lib/failures.ts';

/** Each VU logs at most one sample per step, reason and status; this caps huge runs. */
const MAX_READ_BYTES = 2 * 1024 * 1024;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const SAMPLE_PATTERN = new RegExp(`${FAILURE_LOG_PREFIX}([A-Za-z0-9+/=]+)`);

function decode(line: string): FailureSample | undefined {
  const encoded = SAMPLE_PATTERN.exec(line)?.[1];
  if (!encoded) return undefined;
  try {
    const sample = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as FailureSample;
    if (typeof sample.step !== 'string' || typeof sample.body !== 'string') return undefined;
    // Postgres jsonb refuses NUL and unpaired surrogates (a body cut inside an emoji).
    return { ...sample, body: sample.body.replaceAll('\0', '').replace(LONE_SURROGATE, '\uFFFD') };
  } catch {
    return undefined;
  }
}

/** The start of the file, or '' when k6 never created it (it did not start). */
async function readStart(path: string): Promise<string> {
  let file;
  try {
    file = await open(path, 'r');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
  try {
    const buffer = Buffer.alloc(MAX_READ_BYTES);
    const { bytesRead } = await file.read(buffer, 0, MAX_READ_BYTES, 0);
    // A line cut at the limit fails to decode and is skipped.
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await file.close();
  }
}

/**
 * Distinct failures across all VUs, in the order k6 logged them: at most MAX_BODIES_PER_STATUS
 * bodies per step, reason and status, and MAX_FAILURES_PER_STEP per step.
 */
export async function readFailures(path: string): Promise<FailureSample[]> {
  const seen = new Set<string>();
  const perStatus = new Map<string, number>();
  const perStep = new Map<string, number>();
  const failures: FailureSample[] = [];
  for (const sample of (await readStart(path)).split('\n').map(decode)) {
    if (!sample) continue;
    const statusKey = JSON.stringify([sample.step, sample.reason, sample.status]);
    const key = JSON.stringify([sample.step, sample.reason, sample.status, sample.body]);
    const statusCount = perStatus.get(statusKey) ?? 0;
    const stepCount = perStep.get(sample.step) ?? 0;
    if (seen.has(key) || statusCount >= MAX_BODIES_PER_STATUS) continue;
    if (stepCount >= MAX_FAILURES_PER_STEP) continue;
    seen.add(key);
    perStatus.set(statusKey, statusCount + 1);
    perStep.set(sample.step, stepCount + 1);
    failures.push(sample);
  }
  return failures;
}
