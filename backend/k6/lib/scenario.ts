// What one virtual user does. Shared by every test type; tests only differ in load shape (options).
// Each iteration runs the flow's steps in order; values saved from one response feed the next.
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { config } from './config.ts';
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
  // Only steps that extract values read the body; the rest discard it to save VU memory.
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

function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/** Sends one step. Returns false when the iteration must end (wrong status or missing value). */
function runStep(
  { step, responseCallback, urlName, hasContentType, redirects, responseType }: PreparedStep,
  values: FlowValues,
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
      responseType,
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
  if (!statusOk) return false;
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
    if (!saved) return false;
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
  for (const step of flow) {
    const ok = runStep(step, values);
    sleep(waitSeconds(step.step, config.thinkTimeSeconds));
    if (!ok) return;
  }
}
