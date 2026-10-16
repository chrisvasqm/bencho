let nextId = 0;

/** Unique id for editor rows (steps, header rows, stages), stable for the session. */
export function newId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}
