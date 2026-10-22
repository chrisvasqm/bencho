// Filters above the run list: one test type or all, and a range of calendar days.
import { RUN_TYPES } from '../../api/runs.ts';
import { DateRangePicker, SegmentedControl } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import type { RunFilterValues } from './filters.ts';

export interface RunFiltersProps {
  values: RunFilterValues;
  onChange: (values: RunFilterValues) => void;
}

export function RunFilters({ values, onChange }: RunFiltersProps) {
  const { t } = useCopy();
  return (
    <div className="flex flex-col gap-2" data-testid="runs-filters">
      <SegmentedControl
        label={t('runs.filterType')}
        testId="runs-filter-type"
        fullWidth
        value={values.type}
        onChange={(type) => onChange({ ...values, type })}
        options={[
          { value: 'all', label: t('runs.filterAllTypes') },
          ...RUN_TYPES.map((type) => ({ value: type, label: t(`runType.${type}`) })),
        ]}
      />
      <DateRangePicker
        labels={{ from: t('runs.filterFrom'), to: t('runs.filterTo') }}
        testIds={{ from: 'runs-filter-from', to: 'runs-filter-to' }}
        value={{ from: values.fromDay, to: values.toDay }}
        onChange={({ from, to }) => onChange({ ...values, fromDay: from, toDay: to })}
      />
    </div>
  );
}
