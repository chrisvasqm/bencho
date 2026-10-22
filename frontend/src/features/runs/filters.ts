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

/** Both days set and the end before the start: the range holds nothing. */
export const isRangeInverted = (values: RunFilterValues) =>
  values.fromDay !== '' && values.toDay !== '' && values.toDay < values.fromDay;

/**
 * Local midnight that starts the day, `daysLater` days on. setFullYear, not the Date
 * constructor: the constructor reads years 0-99 as 1900-1999.
 */
function dayToInstant(day: string, daysLater: number): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const instant = new Date(0);
  instant.setFullYear(year, month - 1, date + daysLater);
  instant.setHours(0, 0, 0, 0);
  return instant.toISOString();
}

/**
 * The query the API takes: `to` is the midnight after the last day, since the API excludes it.
 * An inverted range sends no dates, so the list stays useful while the user fixes it.
 */
export function toListFilters(values: RunFilterValues): RunListFilters {
  const filters: RunListFilters = {};
  if (values.type !== 'all') filters.type = values.type;
  if (isRangeInverted(values)) return filters;
  if (values.fromDay) filters.from = dayToInstant(values.fromDay, 0);
  if (values.toDay) filters.to = dayToInstant(values.toDay, 1);
  return filters;
}

/** True when the query sent to the API narrows the list. */
export const hasListFilters = (filters: RunListFilters) => Object.keys(filters).length > 0;
