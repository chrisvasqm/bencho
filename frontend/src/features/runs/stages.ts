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

const TARGET_PATTERN = /^\d+(\.\d+)?$/;

/** "0,25" or "0.25" → 0.25. Anything else, empty included, is NaN, so validation reports it. */
export function parseTarget(text: string): number {
  const value = text.trim().replace(',', '.');
  return TARGET_PATTERN.test(value) ? Number(value) : Number.NaN;
}
