// Failed responses kept as samples, so a run report can show why steps failed.
// No k6 imports: the backend reads the same constants when it parses the samples.

/** One failed step: its status and the start of the response body (or the network error). */
export interface FailureSample {
  step: string;
  /** status: the step got another status than expected; extract: a value to save was missing. */
  reason: 'status' | 'extract';
  status: number;
  body: string;
}

/** Bodies are read in one of this many flow runs per VU (and in each VU's first run). */
export const FAILURE_SAMPLE_EVERY = 20;
export const MAX_FAILURE_BODY_CHARS = 500;
/** Distinct failures kept per step, per VU in k6 and per run in the backend. */
export const MAX_FAILURES_PER_STEP = 10;
/** k6 writes each sample to its console output as this prefix plus base64 JSON. */
export const FAILURE_LOG_PREFIX = 'BENCHO_FAILURE ';
