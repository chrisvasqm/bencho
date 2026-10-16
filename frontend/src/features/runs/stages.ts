import type { Stage } from '../../api/runs.ts';
import { newId } from './ids.ts';

/** A stage as the editor holds it, with a stable id so rows keep focus when others are removed. */
export interface StageRow extends Stage {
  id: string;
}

export function toStageRow(stage: Stage): StageRow {
  return { ...stage, id: newId('stage') };
}
