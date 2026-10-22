// The run list filters as the user sets them (type, and calendar days in the browser's zone),
// and their translation into the instants the API takes.
import type { RunListFilters, RunType } from '../../api/runs.ts';

export interface RunFilterValues {
  /** `all` lists every type. */
  type: RunType | 'all';
  /** Calendar days as `YYYY-MM-DD`, empty when not set. */
  fromDay: string;
  toDay: string;
}

export const EMPTY_RUN_FILTERS: RunFilterValues = { type: 'all', fromDay: '', toDay: '' };

export const isFiltering = (values: RunFilterValues) =>
  values.type !== 'all' || values.fromDay !== '' || values.toDay !== '';

/** Both days set and the end before the start: the range holds nothing. */
export const isRangeInverted = (values: RunFilterValues) =>
  values.fromDay !== '' && values.toDay !== '' && values.toDay < values.fromDay;

/** Local midnight that starts the day; `endOf` gives the last millisecond of the day. */
function dayToInstant(day: string, endOf: boolean): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const instant = endOf
    ? new Date(year, month - 1, date + 1, 0, 0, 0, -1)
    : new Date(year, month - 1, date);
  return instant.toISOString();
}

/** The query the API takes. An inverted range sends no dates, so the list stays useful. */
export function toListFilters(values: RunFilterValues): RunListFilters {
  const filters: RunListFilters = {};
  if (values.type !== 'all') filters.type = values.type;
  if (isRangeInverted(values)) return filters;
  if (values.fromDay) filters.from = dayToInstant(values.fromDay, false);
  if (values.toDay) filters.to = dayToInstant(values.toDay, true);
  return filters;
}
