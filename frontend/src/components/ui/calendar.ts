// Calendar days as `YYYY-MM-DD` strings in the browser's zone. Strings in this form sort like
// the days they name, so min/max checks are plain comparisons.

export interface DayParts {
  year: number;
  /** 0 = January, as in Date. */
  month: number;
  date: number;
}

const pad = (part: number, length = 2) => String(part).padStart(length, '0');

/**
 * Normalizes overflow (month 12, date 0) like Date does. setFullYear, not the Date constructor:
 * the constructor reads years 0-99 as 1900-1999.
 */
export function toDay(year: number, month: number, date: number): string {
  const day = new Date(0);
  day.setFullYear(year, month, date);
  return `${pad(day.getFullYear(), 4)}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function parseDay(day: string): DayParts {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return { year, month: month - 1, date };
}

export function today(): string {
  const now = new Date();
  return toDay(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(day: string, count: number): string {
  const { year, month, date } = parseDay(day);
  return toDay(year, month, date + count);
}

/** The same date `count` months on, kept inside the target month (Jan 31 + 1 → Feb 28). */
export function addMonths(day: string, count: number): string {
  const { year, month, date } = parseDay(day);
  const first = parseDay(toDay(year, month + count, 1));
  return toDay(first.year, first.month, Math.min(date, daysInMonth(first.year, first.month)));
}

export function daysInMonth(year: number, month: number): number {
  return parseDay(toDay(year, month + 1, 0)).date;
}

/** `YYYY-MM`, which sorts like the months it names. */
export const monthKey = (year: number, month: number) => toDay(year, month, 1).slice(0, 7);

/** Keeps the day inside the bounds that are set. */
export function clampDay(day: string, min?: string, max?: string): string {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
}

export const isOutside = (day: string, min?: string, max?: string) =>
  Boolean((min && day < min) || (max && day > max));

/** 0 = Sunday. English weeks start on Sunday; Spanish ones on Monday. */
export const firstWeekday = (language: string) => (language.startsWith('en') ? 0 : 1);

/** The days of a month as a grid of weeks; `undefined` fills the cells outside the month. */
export function monthGrid(year: number, month: number, weekStart: number): (string | undefined)[] {
  const leading = (new Date(toDay(year, month, 1) + 'T00:00').getDay() - weekStart + 7) % 7;
  const cells: (string | undefined)[] = Array.from({ length: leading }, () => undefined);
  for (let date = 1; date <= daysInMonth(year, month); date += 1) {
    cells.push(toDay(year, month, date));
  }
  while (cells.length % 7 !== 0) cells.push(undefined);
  return cells;
}
