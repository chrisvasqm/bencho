// Reads the failure samples k6 writes to its console output (see k6/lib/failures.ts).
import { readFile } from 'node:fs/promises';
import {
  FAILURE_LOG_PREFIX,
  MAX_FAILURES_PER_STEP,
  type FailureSample,
} from '../../../k6/lib/failures.ts';

const SAMPLE_PATTERN = new RegExp(`${FAILURE_LOG_PREFIX}([A-Za-z0-9+/=]+)`);

function decode(line: string): FailureSample | undefined {
  const encoded = SAMPLE_PATTERN.exec(line)?.[1];
  if (!encoded) return undefined;
  try {
    const sample = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as FailureSample;
    return typeof sample.step === 'string' ? sample : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Distinct failures across all VUs, in the order k6 logged them, at most MAX_FAILURES_PER_STEP
 * per step. A missing file (k6 never started) means no failures.
 */
export async function readFailures(path: string): Promise<FailureSample[]> {
  const text = await readFile(path, 'utf8').catch(() => '');
  const seen = new Set<string>();
  const perStep = new Map<string, number>();
  const failures: FailureSample[] = [];
  for (const sample of text.split('\n').map(decode)) {
    if (!sample) continue;
    const key = JSON.stringify([sample.step, sample.reason, sample.status, sample.body]);
    const count = perStep.get(sample.step) ?? 0;
    if (seen.has(key) || count >= MAX_FAILURES_PER_STEP) continue;
    seen.add(key);
    perStep.set(sample.step, count + 1);
    failures.push(sample);
  }
  return failures;
}
