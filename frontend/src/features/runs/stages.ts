import type { Stage } from '../../api/runs.ts';
import { newId } from './ids.ts';

/**
 * A stage as the editor holds it, with a stable id so rows keep focus when others are removed.
 * The target is kept as typed (targetText), so "0," or "0,25" never turns into 0 while typing.
 */
export interface StageRow extends Stage {
  id: string;
  targetText: string;
}

export function toStageRow(stage: Stage): StageRow {
  return { ...stage, targetText: String(stage.target), id: newId('stage') };
}

// A comma followed by 3 digits ("1,000") reads as a thousands separator, so it is refused and
// never becomes 1. A point is always a decimal point ("10.0", "0.250"); validation then checks
// whole VUs, or a rate with at most 2 decimals.
const WHOLE_PATTERN = /^\d+(\.\d+)?$/;
const RATE_PATTERN = /^(\d+|\d*\.\d+|\d*,\d{1,2})$/;

/** The typed target as a number, or NaN (empty included) so validation reports it. */
export function parseTarget(text: string, decimals: boolean): number {
  const value = text.trim();
  if (!(decimals ? RATE_PATTERN : WHOLE_PATTERN).test(value)) return Number.NaN;
  return Number(value.replace(',', '.'));
}
