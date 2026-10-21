// Reads the failure samples k6 writes to its console output (see k6/lib/failures.ts).
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import {
  FAILURE_LOG_PREFIX,
  MAX_BODIES_PER_STATUS,
  MAX_FAILURES_PER_STEP,
  type FailureSample,
} from '../../../k6/lib/failures.ts';

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const SAMPLE_PATTERN = new RegExp(`${FAILURE_LOG_PREFIX}([A-Za-z0-9+/=]+)`);

function decode(line: string): FailureSample | undefined {
  const encoded = SAMPLE_PATTERN.exec(line)?.[1];
  if (!encoded) return undefined;
  try {
    const sample = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as FailureSample;
    const valid =
      typeof sample.step === 'string' &&
      typeof sample.body === 'string' &&
      typeof sample.status === 'number' &&
      (sample.reason === 'status' || sample.reason === 'extract');
    if (!valid) return undefined;
    // Postgres jsonb refuses NUL and unpaired surrogates (a body cut inside an emoji).
    return { ...sample, body: sample.body.replaceAll('\0', '').replace(LONE_SURROGATE, '\uFFFD') };
  } catch {
    return undefined;
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
  const add = (sample: FailureSample) => {
    const statusKey = JSON.stringify([sample.step, sample.reason, sample.status]);
    const key = JSON.stringify([sample.step, sample.reason, sample.status, sample.body]);
    const statusCount = perStatus.get(statusKey) ?? 0;
    const stepCount = perStep.get(sample.step) ?? 0;
    if (seen.has(key) || statusCount >= MAX_BODIES_PER_STATUS) return;
    if (stepCount >= MAX_FAILURES_PER_STEP) return;
    seen.add(key);
    perStatus.set(statusKey, statusCount + 1);
    perStep.set(sample.step, stepCount + 1);
    failures.push(sample);
  };
  try {
    // Line by line: a run with thousands of VUs can log many samples, and the later lines may be
    // the only ones for some steps.
    const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of lines) {
      const sample = decode(line);
      if (sample) add(sample);
    }
  } catch (error) {
    // No file means k6 never started. Samples only explain a run; a read error must not lose it.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('could not read k6 failure samples', error);
    }
  }
  return failures;
}
