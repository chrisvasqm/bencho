import type { Copy } from '../../i18n/useCopy.ts';
import type { LearnItem } from './LearnMore.tsx';

/** When a run fails; a rate run has one more reason. Shared by the form and the result card. */
export function failItem(t: Copy, mode: string): LearnItem {
  return {
    term: t('learn.fail.term'),
    points: [
      t('learn.fail.limit'),
      t('learn.fail.errors'),
      t('learn.fail.checks'),
      ...(mode === 'rate' ? [t('learn.fail.rate')] : []),
    ],
  };
}

/** What p95, p50 and p99 mean. */
export function percentileItems(t: Copy): LearnItem[] {
  return [
    { term: t('learn.percentile.p95Term'), points: [t('learn.percentile.p95')] },
    {
      term: t('learn.percentile.otherTerm'),
      points: [t('learn.percentile.p50'), t('learn.percentile.p99'), t('learn.percentile.average')],
    },
  ];
}
