// What one virtual user does. Shared by every test type; tests only differ in load shape (options).
// Each iteration runs the flow's steps in order; values saved from one response feed the next.
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import encoding from 'k6/encoding';
import { config } from './config.ts';
import {
  FAILURE_LOG_PREFIX,
  FAILURE_SAMPLE_EVERY,
  MAX_FAILURES_PER_STEP,
  MAX_FAILURE_BODY_CHARS,
  type FailureSample,
} from './failures.ts';
import {
  DEFAULT_FLOW,
  fillJsonBody,
  fillPlaceholders,
  stepUrl,
  waitSeconds,
  type FlowStep,
  type FlowValues,
} from './flow.ts';

// The backend writes the flow to a file: an env var would hit the OS size limit for large flows.
// SharedArray parses it once and shares one read-only copy across VUs.
const flowSteps = new SharedArray<FlowStep>('flow', () =>
  __ENV.FLOW_PATH ? (JSON.parse(open(__ENV.FLOW_PATH)) as FlowStep[]) : DEFAULT_FLOW,
);

/**
 * k6 error codes for a target refused by K6_BLACKLIST_IPS (1110) or K6_BLOCK_HOSTNAMES (1111).
 * The backend sets both when private targets are not allowed; one such request ends the test.
 */
const BLOCKED_TARGET_ERROR_CODES = new Set([1110, 1111]);

interface PreparedStep {
  step: FlowStep;
  // http_req_failed (and the error-rate limit) must agree with the step's expected status.
  responseCallback: ReturnType<typeof http.expectedStatuses>;
  // One name per step, not per filled URL, so placeholders in paths never multiply metric series.
  urlName: string;
  hasContentType: boolean;
  // A step that expects a redirect must see it, not the page it points to.
  redirects: number | undefined;
  // Bodies are discarded by default (options.ts); steps that extract values read theirs.
  // Always set: k6 rejects an undefined responseType.
  responseType: 'text' | 'none';
}

const flow: PreparedStep[] = Array.from(flowSteps, (step) => ({
  step,
  responseCallback: http.expectedStatuses(step.expectedStatus),
  urlName: stepUrl(config.baseUrl, step.path),
  hasContentType: Object.keys(step.headers).some((name) => name.toLowerCase() === 'content-type'),
  redirects: step.expectedStatus >= 300 && step.expectedStatus < 400 ? 0 : undefined,
  responseType: step.extract.length > 0 ? 'text' : 'none',
}));

// Per VU (module state is per VU in k6): failures already reported, by step.
const reportedFailures = new Map<string, Set<string>>();

/** Logs a failure once per step, status and body, up to MAX_FAILURES_PER_STEP per step. */
function reportFailure(
  stepName: string,
  reason: FailureSample['reason'],
  response: ReturnType<typeof http.request>,
): void {
  const text = typeof response.body === 'string' ? response.body : response.error;
  const body = (text || '').slice(0, MAX_FAILURE_BODY_CHARS);
  const seen = reportedFailures.get(stepName) ?? new Set<string>();
  reportedFailures.set(stepName, seen);
  const key = `${reason}|${response.status}|${body}`;
  if (seen.has(key) || seen.size >= MAX_FAILURES_PER_STEP) return;
  seen.add(key);
  const sample: FailureSample = { step: stepName, reason, status: response.status, body };
  // Base64 keeps the line free of quotes and line breaks in k6's log format.
  console.log(FAILURE_LOG_PREFIX + encoding.b64encode(JSON.stringify(sample)));
}

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/**
 * Sends one step. Returns false when the iteration must end (wrong status or missing value).
 * In a sampled iteration every body is read, so failures can be reported with their body.
 */
function runStep(
  { step, responseCallback, urlName, hasContentType, redirects, responseType }: PreparedStep,
  values: FlowValues,
  sampled: boolean,
): boolean {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(step.headers)) {
    // A saved value with a line break would make the header invalid.
    headers[name] = fillPlaceholders(value, values).replace(/[\r\n]+/g, ' ');
  }
  const body = step.body === null ? null : fillJsonBody(step.body, values);
  if (body !== null && !hasContentType) headers['Content-Type'] = 'application/json';
  const response = http.request(
    step.method,
    stepUrl(config.baseUrl, fillPlaceholders(step.path, values, encodeURIComponent)),
    body,
    {
      headers,
      tags: { step: step.name, name: urlName },
      responseCallback,
      redirects,
      responseType: sampled ? 'text' : responseType,
    },
  );
  if (BLOCKED_TARGET_ERROR_CODES.has(response.error_code)) {
    // Exit code 108: the backend reports the run as an error instead of letting it spin.
    exec.test.abort(`${step.name}: the target is a private or local address`);
  }
  const statusOk = check(response, {
    [`${step.name}: status ${step.expectedStatus}`]: (checked) =>
      checked.status === step.expectedStatus,
  });
  if (!statusOk) {
    if (sampled) reportFailure(step.name, 'status', response);
    return false;
  }
  for (const extract of step.extract) {
    let value: unknown;
    try {
      value = response.json(extract.path);
    } catch {
      value = undefined; // not a JSON response
    }
    const saved = check(value, {
      [`${step.name}: saves ${extract.name}`]: (checked) =>
        checked !== undefined && checked !== null,
    });
    if (!saved) {
      if (sampled) reportFailure(step.name, 'extract', response);
      return false;
    }
    values[extract.name] = value;
  }
  return true;
}

export default function (): void {
  const uuid = randomUuid();
  const values: FlowValues = {
    vu: __VU,
    iter: __ITER,
    uuid,
    shortId: uuid.replace(/-/g, '').slice(0, 12),
  };
  const sampled = __ITER % FAILURE_SAMPLE_EVERY === 0;
  for (const step of flow) {
    const ok = runStep(step, values, sampled);
    sleep(waitSeconds(step.step, config.thinkTimeSeconds));
    if (!ok) return;
  }
}
