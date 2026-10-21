// Failed responses kept as samples, so a run report can show why steps failed.
// No k6 imports: the backend reads the same constants when it parses the samples.

/**
 * One failed step: its status and the start of the response body (or the network error). For a
 * success status (2xx) the body may hold tokens, so `body` is only its JSON keys.
 */
export interface FailureSample {
  step: string;
  /** status: the step got another status than expected; extract: a value to save was missing. */
  reason: 'status' | 'extract';
  status: number;
  body: string;
}

/** Bodies are read in one of this many flow runs, counted across all VUs. */
export const FAILURE_SAMPLE_EVERY = 20;
export const MAX_FAILURE_BODY_CHARS = 500;
/** Distinct failures kept per step in a run. */
export const MAX_FAILURES_PER_STEP = 10;
/** Different bodies kept per step and status, so one noisy error cannot fill a step's slots. */
export const MAX_BODIES_PER_STATUS = 3;
/** k6 writes each sample to its console output as this prefix plus base64 JSON. */
export const FAILURE_LOG_PREFIX = 'BENCHO_FAILURE ';
