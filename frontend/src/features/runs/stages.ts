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

// Whole digits for VUs, so "1,000" is an error and never 1. A rate takes one decimal comma or
// point with up to 2 digits after it: "0,25", "0.25", ".25".
const WHOLE_PATTERN = /^\d+$/;
const RATE_PATTERN = /^(\d+|\d*[.,]\d{1,2})$/;

/** The typed target as a number, or NaN (empty included) so validation reports it. */
export function parseTarget(text: string, decimals: boolean): number {
  const value = text.trim();
  if (!(decimals ? RATE_PATTERN : WHOLE_PATTERN).test(value)) return Number.NaN;
  return Number(value.replace(',', '.'));
}
