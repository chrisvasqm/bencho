// Filters above the run list: one test type or all, and a range of calendar days.
import { X } from 'lucide-react';
import { RUN_TYPES } from '../../api/runs.ts';
import { Button, Input, SegmentedControl } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import {
  EMPTY_RUN_FILTERS,
  isFiltering,
  isRangeInverted,
  type RunFilterValues,
} from './filters.ts';

export interface RunFiltersProps {
  values: RunFilterValues;
  onChange: (values: RunFilterValues) => void;
}

export function RunFilters({ values, onChange }: RunFiltersProps) {
  const { t } = useCopy();
  const inverted = isRangeInverted(values);
  return (
    <div className="flex flex-col gap-2" data-testid="runs-filters">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          label={t('runs.filterType')}
          testId="runs-filter-type"
          value={values.type}
          onChange={(type) => onChange({ ...values, type })}
          options={[
            { value: 'all', label: t('runs.filterAllTypes') },
            ...RUN_TYPES.map((type) => ({ value: type, label: t(`runType.${type}`) })),
          ]}
        />
        {isFiltering(values) && (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 px-2"
            aria-label={t('runs.filterClear')}
            data-testid="runs-filter-clear"
            onClick={() => onChange(EMPTY_RUN_FILTERS)}
          >
            <X size={14} aria-hidden />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fg-muted">
          {t('runs.filterFrom')}
          <Input
            type="date"
            data-testid="runs-filter-from"
            className="h-8 px-2 text-xs"
            value={values.fromDay}
            max={values.toDay || undefined}
            invalid={inverted}
            onChange={(event) => onChange({ ...values, fromDay: event.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fg-muted">
          {t('runs.filterTo')}
          <Input
            type="date"
            data-testid="runs-filter-to"
            className="h-8 px-2 text-xs"
            value={values.toDay}
            min={values.fromDay || undefined}
            invalid={inverted}
            onChange={(event) => onChange({ ...values, toDay: event.target.value })}
          />
        </label>
      </div>
      {inverted && (
        <p role="alert" data-testid="runs-filter-range-error" className="text-xs text-danger">
          {t('runs.filterRangeInverted')}
        </p>
      )}
    </div>
  );
}
