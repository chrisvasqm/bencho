// Basic shows the main settings in plain words; Advanced shows every setting with technical terms.
import { storedChoice } from './storedChoice.ts';

export const DETAILS = ['basic', 'advanced'] as const;
export type Detail = (typeof DETAILS)[number];

export const DETAIL_STORAGE_KEY = 'detail';

const detail = storedChoice<Detail>(DETAIL_STORAGE_KEY, DETAILS, () => 'basic');

export const useDetail = detail.use;
