// Multi-step flows: the requests one virtual user sends per iteration, in order.
// No k6 imports: the backend validates flows with the same rules.
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface FlowExtract {
  /** Placeholder name later steps use as {{name}}. */
  name: string;
  /** Response JSON selector (k6 gjson syntax), for example token, pizza.id or ratings.0.id. */
  path: string;
}

export interface FlowStep {
  name: string;
  method: HttpMethod;
  /** '' sends to the base URL as is; '/api/x' is appended to it; a full URL is used as is. */
  path: string;
  headers: Record<string, string>;
  /** JSON text with placeholders, or null for no body. */
  body: string | null;
  expectedStatus: number;
  extract: FlowExtract[];
  /** Random wait after the step, picked each iteration. Without it the step waits the think time. */
  wait?: FlowWait;
}

export interface FlowWait {
  minSeconds: number;
  maxSeconds: number;
}

export const MAX_STEPS = 20;
export const MAX_EXTRACTS = 10;
export const MAX_HEADERS = 20;
export const MAX_BODY_LENGTH = 10_000;
export const MAX_STEP_NAME_LENGTH = 60;
export const MAX_HEADER_VALUE_LENGTH = 4000;
/** One wait fits in k6's default graceful stop (30s); whole iterations can still be cut off. */
export const MAX_WAIT_SECONDS = 30;

/** Values available to placeholders: built-ins and values saved from responses, typed. */
export type FlowValues = Record<string, unknown>;

/**
 * Values every step can use. {{uuid}} and {{shortId}} (12 hex characters, for fields with a
 * length limit such as usernames) are one value per iteration, shared by all its steps.
 */
export const BUILTIN_PLACEHOLDERS = ['vu', 'iter', 'uuid', 'shortId'] as const;
export const PLACEHOLDER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PLACEHOLDER_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g;

/** The flow of runs that do not set one: a single GET to the base URL. */
export const DEFAULT_FLOW: FlowStep[] = [
  {
    name: 'Home',
    method: 'GET',
    path: '',
    headers: {},
    body: null,
    expectedStatus: 200,
    extract: [],
  },
];

function asText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Replaces {{name}} with its value as text. Unknown names stay as written. */
export function fillPlaceholders(
  text: string,
  values: FlowValues,
  encode: (value: string) => string = (value) => value,
): string {
  return text.replace(PLACEHOLDER_PATTERN, (match, name: string) =>
    name in values ? encode(asText(values[name])) : match,
  );
}

/**
 * Fills placeholders in a JSON body so the result stays JSON and keeps each value's type:
 * inside a string a value is escaped text; outside one it is the value as JSON ("abc", 6, true).
 */
export function fillJsonBody(body: string, values: FlowValues): string {
  let result = '';
  let inString = false;
  let index = 0;
  while (index < body.length) {
    const char = body.charAt(index);
    const close = body.startsWith('{{', index) ? body.indexOf('}}', index + 2) : -1;
    const name = close === -1 ? undefined : body.slice(index + 2, close).trim();
    if (name !== undefined && name in values) {
      const value = values[name];
      result += inString ? JSON.stringify(asText(value)).slice(1, -1) : JSON.stringify(value);
      index = close + 2;
      continue;
    }
    if (inString && char === '\\') {
      result += body.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (char === '"') inString = !inString;
    result += char;
    index += 1;
  }
  return result;
}

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] ?? '');
}

/** Seconds to wait after a step: a random value in its wait range, or the run's think time. */
export function waitSeconds(step: FlowStep, thinkTimeSeconds: number): number {
  if (!step.wait) return thinkTimeSeconds;
  const { minSeconds, maxSeconds } = step.wait;
  return minSeconds + Math.random() * (maxSeconds - minSeconds);
}

/** A step path that is a URL of its own, used as is instead of being appended to the base URL. */
export function isFullUrl(path: string): boolean {
  return /^https?:\/\//.test(path);
}

/**
 * A full URL whose host or port is a placeholder ({{tenant}}.example.com) cannot be parsed or
 * checked before the run; k6 fills it per iteration and refuses private addresses itself.
 */
export function hasPlaceholderHost(url: string): boolean {
  const authority = url.slice(url.indexOf('//') + 2).split(/[/?#]/, 1)[0] ?? '';
  return authority.includes('{{');
}

/** Puts the path before the base URL's query, and merges both queries. */
export function stepUrl(baseUrl: string, path: string): string {
  if (path === '') return baseUrl;
  if (isFullUrl(path)) return path;
  const [, base = '', query = ''] = /^([^?#]*)(?:\?([^#]*))?/.exec(baseUrl) ?? [];
  const url = base.replace(/\/+$/, '') + path;
  if (query === '') return url;
  return url + (url.includes('?') ? '&' : '?') + query;
}

/**
 * Returns the first problem in the flow, or null when it is valid: placeholders must be built in
 * or saved by an earlier step, and a body must be JSON once placeholders are filled.
 */
export function flowProblem(steps: FlowStep[]): string | null {
  const known = new Set<string>(BUILTIN_PLACEHOLDERS);
  const names = steps.map((step) => step.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Each step needs its own name';
  for (const [index, step] of steps.entries()) {
    const label = `Step ${index + 1} (${step.name})`;
    if (step.path !== '' && !step.path.startsWith('/') && !isFullUrl(step.path)) {
      return `${label}: the path must be empty, start with / or be a full URL`;
    }
    if (step.wait && step.wait.maxSeconds < step.wait.minSeconds) {
      return `${label}: the longest wait must be at least the shortest wait`;
    }
    const headerNames = Object.keys(step.headers).map((name) => name.toLowerCase());
    if (new Set(headerNames).size !== headerNames.length) {
      return `${label}: each header name can be used only once`;
    }
    const texts = [step.path, step.body ?? '', ...Object.values(step.headers)];
    const unknown = texts.flatMap(placeholdersIn).find((name) => !known.has(name));
    if (unknown !== undefined) {
      return `${label}: {{${unknown}}} is not built in and no earlier step saves it`;
    }
    if (step.body !== null) {
      try {
        // Fill as the run will, with a string and a number: values can be either, and each
        // sample catches misuse the other misses (1{{x}} for strings, {{{x}}: 1} for numbers).
        for (const sampleValue of ['x', 0]) {
          const sample = Object.fromEntries([...known].map((name) => [name, sampleValue]));
          JSON.parse(fillJsonBody(step.body, sample));
        }
      } catch {
        return `${label}: the body must be valid JSON`;
      }
    }
    for (const extract of step.extract) known.add(extract.name);
  }
  return null;
}
