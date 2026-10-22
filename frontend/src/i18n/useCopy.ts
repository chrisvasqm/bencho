// Text for the active language.
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

/** A typed translate function: only keys that exist in en.ts compile. */
export type Copy = TFunction;

export function useCopy() {
  const { t, i18n } = useTranslation();
  return { t: t as Copy, language: i18n.language };
}
