import { useQuery } from '@tanstack/react-query';
import { runsApi } from '../../api/runs.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { capacityItems } from '../learn/items.ts';
import { LearnMore } from '../learn/LearnMore.tsx';

// Free memory changes as runs start and stop.
const REFRESH_MS = 10_000;

export interface CapacityHintProps {
  /** The most VUs the run can use: the largest stage target, or a rate run's VU cap. */
  peakTarget: number;
  /** True when peakTarget is a rate run's VU cap, not a stage target. */
  rate: boolean;
}

/** Rough VU estimate for the Bencho host, with a warning when the stages go above it. */
export function CapacityHint({ peakTarget, rate }: CapacityHintProps) {
  const { t, language } = useCopy();
  const capacity = useQuery({
    queryKey: ['capacity'],
    queryFn: runsApi.capacity,
    refetchInterval: REFRESH_MS,
  });
  if (!capacity.data) return null;
  const { estimatedVirtualUsers } = capacity.data;
  const estimate = estimatedVirtualUsers.toLocaleString(language);
  return (
    <div className="flex flex-col gap-1 text-xs text-fg-muted">
      <div className="flex items-start justify-between gap-3">
        <p className="m-0" data-testid="capacity-estimate">
          {t('capacity.estimate', { estimate })}
        </p>
        <LearnMore
          testId="learn-capacity"
          className="shrink-0"
          title={t('capacity.title')}
          items={capacityItems(t, capacity.data)}
        />
      </div>
      {/* Always mounted (hidden when empty), so screen readers announce changes politely. */}
      <p
        role="status"
        className="m-0 font-medium text-warning empty:sr-only"
        data-testid="capacity-warning"
      >
        {peakTarget > estimatedVirtualUsers &&
          t(rate ? 'capacity.warningRate' : 'capacity.warning', {
            value: peakTarget.toLocaleString(language),
            estimate,
          })}
      </p>
    </div>
  );
}
