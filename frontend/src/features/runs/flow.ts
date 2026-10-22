// Flow editing helpers: drafts the editor can hold mid-typing, the QuickPizza example and
// checks that mirror the backend so the user sees which step to fix.
import type { BodyFormat, FlowStep, HttpMethod } from '../../api/runs.ts';
import { newId } from './ids.ts';
import { isWellFormedXml } from './xml.ts';

export interface Pair {
  /** Stable React key, so removing a row never moves focus to another one. */
  id: string;
  key: string;
  value: string;
}

/** A step as the editor holds it: rows may be half filled, the body may be empty. */
export interface StepDraft {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  headers: Pair[];
  body: string;
  /** JSON, or SOAP: an XML body and element paths to save values. */
  bodyFormat: BodyFormat;
  expectedStatus: number;
  extract: Pair[];
  /** Wait range in seconds as typed; both empty means the step waits the think time. */
  waitMin: string;
  waitMax: string;
}

export const BUILTIN_PLACEHOLDERS = ['vu', 'iter', 'uuid', 'shortId'] as const;
const MAX_STEPS = 20;
export const MAX_BODY_LENGTH = 10_000;
export const MAX_STEP_NAME_LENGTH = 60;
const MAX_HEADERS = 20;
const MAX_EXTRACTS = 10;
const MAX_PATH_LENGTH = 2000;
const MAX_EXTRACT_PATH_LENGTH = 200;
const MAX_HEADER_VALUE_LENGTH = 4000;
/** Same as the backend's MAX_WAIT_SECONDS (k6's default graceful stop). */
export const MAX_WAIT_SECONDS = 30;
const PLACEHOLDER_PATTERN = /\{\{\s*([^}]*?)\s*\}\}/g;
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const SECONDS_PATTERN = /^(\d+\.?\d*|\.\d+)$/;

/** Plain decimal seconds (1, .5, 1.5 or 1,5). Empty, or text such as 1e1 or 0x10, is NaN. */
function seconds(text: string): number {
  const value = text.trim().replace(',', '.');
  return SECONDS_PATTERN.test(value) ? Number(value) : Number.NaN;
}

export function newPair(key = '', value = ''): Pair {
  return { id: newId('pair'), key, value };
}

export function toDraft(step: FlowStep): StepDraft {
  return {
    id: newId('step'),
    name: step.name,
    method: step.method,
    path: step.path,
    headers: Object.entries(step.headers).map(([key, value]) => newPair(key, value)),
    body: step.body ?? '',
    bodyFormat: step.bodyFormat ?? 'json',
    expectedStatus: step.expectedStatus,
    extract: step.extract.map(({ name, path }) => newPair(name, path)),
    waitMin: step.wait ? String(step.wait.minSeconds) : '',
    waitMax: step.wait ? String(step.wait.maxSeconds) : '',
  };
}

/** Exact duplicate header rows would merge into one entry; report them on the draft. */
export function draftProblem(steps: StepDraft[]): FlowProblem | undefined {
  for (const [index, step] of steps.entries()) {
    const names = step.headers.map((pair) => pair.key.trim().toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) {
      return { message: 'Each header name can be used only once', step: index };
    }
  }
  return undefined;
}

export function fromDraft(draft: StepDraft): FlowStep {
  // Rows with only a value stay, so validation can point at the missing name.
  const hasWait = draft.waitMin.trim() !== '' || draft.waitMax.trim() !== '';
  const filled = (pairs: Pair[]) =>
    pairs.filter((pair) => pair.key.trim() !== '' || pair.value.trim() !== '');
  return {
    name: draft.name.trim(),
    method: draft.method,
    path: draft.path.trim(),
    headers: Object.fromEntries(filled(draft.headers).map((pair) => [pair.key.trim(), pair.value])),
    body: draft.body.trim() === '' ? null : draft.body,
    bodyFormat: draft.bodyFormat,
    expectedStatus: draft.expectedStatus,
    extract: filled(draft.extract).map((pair) => ({
      name: pair.key.trim(),
      path: pair.value.trim(),
    })),
    ...(hasWait && {
      wait: { minSeconds: seconds(draft.waitMin), maxSeconds: seconds(draft.waitMax) },
    }),
  };
}

export function emptyStep(): StepDraft {
  return toDraft({
    name: 'New step',
    method: 'GET',
    path: '/',
    headers: {},
    body: null,
    expectedStatus: 200,
    extract: [],
  });
}

const AUTH = { Authorization: 'Token {{token}}' };
const CREDENTIALS = '{\n  "username": "user-{{shortId}}",\n  "password": "bencho-pass"\n}';

/** A user signs up, logs in, creates a pizza, rates it and lists their ratings. */
export const QUICKPIZZA_FLOW: FlowStep[] = [
  {
    name: 'Sign up',
    method: 'POST',
    path: '/api/users',
    headers: {},
    body: CREDENTIALS,
    expectedStatus: 201,
    extract: [],
  },
  {
    name: 'Log in',
    method: 'POST',
    path: '/api/users/token/login',
    headers: {},
    body: CREDENTIALS,
    expectedStatus: 200,
    extract: [{ name: 'token', path: 'token' }],
  },
  {
    name: 'Create pizza',
    method: 'POST',
    path: '/api/pizza',
    headers: AUTH,
    body: '{\n  "maxCaloriesPerSlice": 1000,\n  "mustBeVegetarian": false,\n  "excludedIngredients": [],\n  "excludedTools": [],\n  "maxNumberOfToppings": 5,\n  "minNumberOfToppings": 2\n}',
    expectedStatus: 200,
    extract: [{ name: 'pizzaId', path: 'pizza.id' }],
  },
  {
    name: 'Rate pizza',
    method: 'POST',
    path: '/api/ratings',
    headers: AUTH,
    body: '{\n  "stars": 5,\n  "pizza_id": {{pizzaId}}\n}',
    expectedStatus: 201,
    extract: [],
  },
  {
    name: 'List ratings',
    method: 'GET',
    path: '/api/ratings',
    headers: AUTH,
    body: null,
    expectedStatus: 200,
    extract: [],
  },
];

/** Mirrors the backend fill: what the body looks like once a run puts string values in. */
function sampleBody(body: string, names: Set<string>, sample: string): string {
  let result = '';
  let inString = false;
  let index = 0;
  while (index < body.length) {
    const char = body.charAt(index);
    const close = body.startsWith('{{', index) ? body.indexOf('}}', index + 2) : -1;
    const name = close === -1 ? undefined : body.slice(index + 2, close).trim();
    if (name !== undefined && names.has(name)) {
      result += inString ? 'x' : sample;
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

function stepProblem(step: FlowStep, known: Set<string>): string | undefined {
  if (step.name === '') return 'give the step a name';
  if (step.name.length > MAX_STEP_NAME_LENGTH) {
    return `the name must be at most ${MAX_STEP_NAME_LENGTH} characters`;
  }
  if (step.path !== '' && !step.path.startsWith('/') && !/^https?:\/\//.test(step.path)) {
    return 'the path must be empty, start with / or be a full URL';
  }
  const { expectedStatus } = step;
  if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
    return 'the expected status must be an HTTP status, such as 200';
  }
  if (step.path.length > MAX_PATH_LENGTH)
    return `the path must be at most ${MAX_PATH_LENGTH} characters`;
  const headerNames = Object.keys(step.headers);
  if (headerNames.length > MAX_HEADERS) return `use at most ${MAX_HEADERS} headers`;
  const badHeader = headerNames.find((name) => !HEADER_NAME_PATTERN.test(name));
  if (badHeader !== undefined) {
    return badHeader === ''
      ? 'every header needs a name'
      : `"${badHeader}" is not a valid header name`;
  }
  if (new Set(headerNames.map((name) => name.toLowerCase())).size !== headerNames.length) {
    return 'each header name can be used only once';
  }
  const headerValues = Object.values(step.headers);
  if (headerValues.some((value) => value.length > MAX_HEADER_VALUE_LENGTH)) {
    return `a header value must be at most ${MAX_HEADER_VALUE_LENGTH} characters`;
  }
  if (headerValues.some((value) => /[\r\n]/.test(value))) {
    return 'header values cannot contain line breaks';
  }
  const texts = [step.path, step.body ?? '', ...Object.values(step.headers)];
  const unknown = texts.flatMap(placeholdersIn).find((name) => !known.has(name));
  if (unknown !== undefined) return `{{${unknown}}} is not built in and no earlier step saves it`;
  if (step.body !== null && step.body.length > MAX_BODY_LENGTH) {
    return `the body must be at most ${MAX_BODY_LENGTH} characters`;
  }
  const soap = step.bodyFormat === 'soap';
  if (step.body !== null && soap) {
    // Values are escaped as XML text, so any sample value keeps the document the same shape.
    const sample = step.body.replace(PLACEHOLDER_PATTERN, 'x');
    if (!isWellFormedXml(sample)) return 'the body must be well-formed XML';
  } else if (step.body !== null) {
    try {
      // Values can be strings or numbers; each sample catches misuse the other misses.
      JSON.parse(sampleBody(step.body, known, '"x"'));
      JSON.parse(sampleBody(step.body, known, '0'));
    } catch {
      return 'the body must be valid JSON';
    }
  }
  if (step.wait) {
    const { minSeconds, maxSeconds } = step.wait;
    const valid = (seconds: number) =>
      Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_WAIT_SECONDS;
    if (!valid(minSeconds) || !valid(maxSeconds)) {
      return `set the shortest and longest wait as numbers from 0 to ${MAX_WAIT_SECONDS}, or leave both empty`;
    }
    if (maxSeconds < minSeconds) return 'the longest wait must be at least the shortest wait';
  }
  if (step.extract.length > MAX_EXTRACTS) return `save at most ${MAX_EXTRACTS} values`;
  const builtIn = new Set<string>(BUILTIN_PLACEHOLDERS);
  const badSave = step.extract.find(
    (item) => !NAME_PATTERN.test(item.name) || builtIn.has(item.name),
  );
  if (badSave) return `"${badSave.name}" cannot be a saved value name`;
  const pathName = soap ? 'element path' : 'JSON path';
  if (step.extract.some((item) => item.path === '')) return `every saved value needs a ${pathName}`;
  if (step.extract.some((item) => item.path.length > MAX_EXTRACT_PATH_LENGTH)) {
    return `a ${pathName} must be at most ${MAX_EXTRACT_PATH_LENGTH} characters`;
  }
  return undefined;
}

export interface FlowProblem {
  message: string;
  /** Index of the step to fix, when the problem belongs to one step. */
  step?: number;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The first problem in the flow, or undefined when the backend will accept it. */
export function flowProblem(steps: FlowStep[]): FlowProblem | undefined {
  if (steps.length === 0) return { message: 'Add at least one step' };
  if (steps.length > MAX_STEPS) return { message: `Use at most ${MAX_STEPS} steps` };
  // Empty names are a per-step problem ("give the step a name"), not a duplicate.
  const names = steps.map((step) => step.name.toLowerCase());
  const duplicate = names.findIndex((name, index) => name !== '' && names.indexOf(name) !== index);
  if (duplicate !== -1) {
    return { message: 'Another step has this name. Give each step its own name.', step: duplicate };
  }
  const known = new Set<string>(BUILTIN_PLACEHOLDERS);
  for (const [index, step] of steps.entries()) {
    const problem = stepProblem(step, known);
    if (problem) return { message: capitalize(problem), step: index };
    for (const item of step.extract) known.add(item.name);
  }
  return undefined;
}
