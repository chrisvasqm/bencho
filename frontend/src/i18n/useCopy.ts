// Text for the active language and detail level: `<key>_advanced` replaces `<key>` in Advanced mode.
import type { TFunction } from 'i18next';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useDetail } from '../features/preferences/detail.ts';

/** A typed translate function: only keys that exist in en.ts compile. */
export type Copy = TFunction;

export function useCopy() {
  const { t, i18n } = useTranslation();
  const [detail] = useDetail();
  const advanced = detail === 'advanced';
  const copy = useCallback(
    ((key: string, options?: Record<string, unknown>) =>
      t(key as never, { ...options, context: advanced ? 'advanced' : undefined } as never)) as Copy,
    [t, advanced],
  );
  return { t: copy, advanced, language: i18n.language };
}
