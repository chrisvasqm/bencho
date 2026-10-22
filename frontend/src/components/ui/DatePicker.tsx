import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.tsx';
import {
  addDays,
  addMonths,
  clampDay,
  firstWeekday,
  isOutside,
  monthGrid,
  monthKey,
  parseDay,
  toDay,
  today,
} from './calendar.ts';
import { cn } from './cn.ts';
import { inputClasses } from './Input.tsx';

export interface DatePickerProps {
  /** A calendar day as `YYYY-MM-DD`, or empty for none. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest and latest days that can be picked, as `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  /** Accessible name of the field and of its calendar. */
  label: string;
  invalid?: boolean;
  /** Which edge of the field the calendar lines up with. */
  align?: 'start' | 'end';
  /** Days from `from` to `to` are tinted, so two pickers read as one range. */
  range?: { from: string; to: string };
  /** The field gets this id; the calendar's parts get it as a prefix. */
  testId?: string;
}

type View = 'days' | 'months' | 'years';

const YEARS_PER_PAGE = 12;

const DAY_KEYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

/**
 * A day field that opens a calendar: days, or a month or year grid from the header, plus Today
 * and Clear. Days outside min/max cannot be picked. Arrow keys move by day and week, Page Up and
 * Page Down by month, Escape closes.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  label,
  invalid,
  align = 'start',
  range,
  testId,
}: DatePickerProps) {
  // UI primitives have no Advanced wording, so plain useTranslation, not useCopy.
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const calendarId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('days');
  // The day with keyboard focus; its month is the one on screen.
  const [focusDay, setFocusDay] = useState(() => clampDay(value || today(), min, max));
  const [yearsPageEnd, setYearsPageEnd] = useState(() => parseDay(focusDay).year);
  const shown = parseDay(focusDay);
  const todayDay = today();
  const id = (part: string) => testId && `${testId}-${part}`;

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const toggle = () => {
    if (open) return close(false);
    const start = clampDay(value || todayDay, min, max);
    setFocusDay(start);
    setYearsPageEnd(parseDay(start).year);
    setView('days');
    setOpen(true);
  };
  const pick = (day: string) => {
    onChange(day);
    close(true);
  };

  // A click outside closes the calendar without a change.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keyboard focus follows the focused day (on open, and as arrow keys move it).
  useEffect(() => {
    if (!open || view !== 'days') return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, view, focusDay]);

  const moveFocus = (day: string) => setFocusDay(clampDay(day, min, max));
  const onGridKeyDown = (event: KeyboardEvent) => {
    const step = DAY_KEYS[event.key];
    if (step !== undefined) moveFocus(addDays(focusDay, step));
    else if (event.key === 'PageUp') moveFocus(addMonths(focusDay, -1));
    else if (event.key === 'PageDown') moveFocus(addMonths(focusDay, 1));
    else return;
    event.preventDefault();
  };

  const minParts = min ? parseDay(min) : undefined;
  const maxParts = max ? parseDay(max) : undefined;
  const monthOutside = (year: number, month: number) =>
    Boolean(
      (minParts && monthKey(year, month) < monthKey(minParts.year, minParts.month)) ||
      (maxParts && monthKey(year, month) > monthKey(maxParts.year, maxParts.month)),
    );
  const yearOutside = (year: number) =>
    Boolean((minParts && year < minParts.year) || (maxParts && year > maxParts.year));

  // Previous and next step by the unit on screen: a month, a year or a page of years.
  const steps: Record<
    View,
    { back: () => void; forward: () => void; canBack: boolean; canForward: boolean }
  > = {
    days: {
      back: () => setFocusDay(clampDay(addMonths(focusDay, -1), min, max)),
      forward: () => setFocusDay(clampDay(addMonths(focusDay, 1), min, max)),
      canBack: !monthOutside(shown.year, shown.month - 1),
      canForward: !monthOutside(shown.year, shown.month + 1),
    },
    months: {
      back: () => setFocusDay(clampDay(addMonths(focusDay, -12), min, max)),
      forward: () => setFocusDay(clampDay(addMonths(focusDay, 12), min, max)),
      canBack: !yearOutside(shown.year - 1),
      canForward: !yearOutside(shown.year + 1),
    },
    years: {
      back: () => setYearsPageEnd(yearsPageEnd - YEARS_PER_PAGE),
      forward: () => setYearsPageEnd(yearsPageEnd + YEARS_PER_PAGE),
      canBack: !yearOutside(yearsPageEnd - YEARS_PER_PAGE),
      canForward: !yearOutside(yearsPageEnd + 1),
    },
  };
  const step = steps[view];

  const monthName = (month: number, style: 'long' | 'short') =>
    new Intl.DateTimeFormat(language, { month: style }).format(new Date(2000, month, 1));
  const weekStart = firstWeekday(language);
  const weekdays = Array.from({ length: 7 }, (_, offset) =>
    // 2023-01-01 was a Sunday.
    new Intl.DateTimeFormat(language, { weekday: 'narrow' }).format(
      new Date(2023, 0, 1 + ((weekStart + offset) % 7)),
    ),
  );
  const fullDate = (day: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date(`${day}T00:00`));
  const shortDate = (day: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(`${day}T00:00`));
  const yearsPage = Array.from(
    { length: YEARS_PER_PAGE },
    (_, index) => yearsPageEnd - YEARS_PER_PAGE + 1 + index,
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={value ? `${label}: ${fullDate(value)}` : label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? calendarId : undefined}
        aria-invalid={invalid || undefined}
        data-testid={testId}
        data-value={value}
        onClick={toggle}
        className={cn(
          inputClasses,
          'flex h-8 items-center gap-2 px-2 text-left text-xs',
          open && 'border-accent-line',
          invalid && 'border-danger',
        )}
      >
        <CalendarDays size={14} aria-hidden className="shrink-0 text-fg-muted" />
        <span className={cn('min-w-0 truncate tabular-nums', !value && 'text-fg-faint')}>
          {value ? shortDate(value) : t('datePicker.placeholder')}
        </span>
      </button>

      {open && (
        <div
          id={calendarId}
          role="dialog"
          aria-label={label}
          data-testid={id('calendar')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            close(true);
          }}
          className={cn(
            'absolute top-full z-30 mt-1.5 w-72 rounded-lg border border-line bg-surface p-3 text-fg shadow-raised',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-1">
            <IconButton
              label={t('datePicker.previous')}
              testId={id('previous')}
              disabled={!step.canBack}
              onClick={step.back}
            >
              <ChevronLeft size={16} aria-hidden />
            </IconButton>
            <div className="flex items-center gap-0.5">
              {view === 'days' && (
                <HeaderButton
                  label={t('datePicker.chooseMonth')}
                  testId={id('month')}
                  onClick={() => setView('months')}
                >
                  {monthName(shown.month, 'long')}
                </HeaderButton>
              )}
              {view === 'years' ? (
                <span className="px-2 text-sm font-semibold tabular-nums">
                  {yearsPage[0]}–{yearsPage[yearsPage.length - 1]}
                </span>
              ) : (
                <HeaderButton
                  label={t('datePicker.chooseYear')}
                  testId={id('year')}
                  onClick={() => {
                    setYearsPageEnd(Math.min(shown.year + 4, maxParts?.year ?? Infinity));
                    setView('years');
                  }}
                >
                  {shown.year}
                </HeaderButton>
              )}
            </div>
            <IconButton
              label={t('datePicker.next')}
              testId={id('next')}
              disabled={!step.canForward}
              onClick={step.forward}
            >
              <ChevronRight size={16} aria-hidden />
            </IconButton>
          </div>

          {view === 'days' && (
            <div ref={gridRef} onKeyDown={onGridKeyDown}>
              <div className="mb-1 grid grid-cols-7 text-center text-xs font-medium text-fg-faint">
                {weekdays.map((weekday, index) => (
                  <span key={index} aria-hidden>
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5">
                {monthGrid(shown.year, shown.month, weekStart).map((day, index) =>
                  day === undefined ? (
                    <span key={`blank-${index}`} />
                  ) : (
                    <DayCell
                      key={day}
                      day={day}
                      label={fullDate(day)}
                      selected={day === value}
                      isToday={day === todayDay}
                      inRange={Boolean(
                        range?.from && range.to && day >= range.from && day <= range.to,
                      )}
                      disabled={isOutside(day, min, max)}
                      focusable={day === focusDay}
                      testId={id(`day-${day}`)}
                      onPick={pick}
                    />
                  ),
                )}
              </div>
            </div>
          )}

          {view === 'months' && (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, month) => (
                <GridChoice
                  key={month}
                  selected={month === shown.month}
                  disabled={monthOutside(shown.year, month)}
                  testId={id(`month-${month + 1}`)}
                  onClick={() => {
                    setFocusDay(
                      clampDay(toDay(shown.year, month, Math.min(shown.date, 28)), min, max),
                    );
                    setView('days');
                  }}
                >
                  {monthName(month, 'short')}
                </GridChoice>
              ))}
            </div>
          )}

          {view === 'years' && (
            <div className="grid grid-cols-3 gap-1">
              {yearsPage.map((year) => (
                <GridChoice
                  key={year}
                  selected={year === shown.year}
                  disabled={yearOutside(year)}
                  testId={id(`year-${year}`)}
                  onClick={() => {
                    setFocusDay(
                      clampDay(toDay(year, shown.month, Math.min(shown.date, 28)), min, max),
                    );
                    setView('months');
                  }}
                >
                  {year}
                </GridChoice>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <Button
              variant="secondary"
              size="sm"
              data-testid={id('clear')}
              disabled={!value}
              onClick={() => pick('')}
            >
              {t('datePicker.clear')}
            </Button>
            <Button
              size="sm"
              data-testid={id('today')}
              disabled={isOutside(todayDay, min, max)}
              onClick={() => pick(todayDay)}
            >
              {t('datePicker.today')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DayCell({
  day,
  label,
  selected,
  isToday,
  inRange,
  disabled,
  focusable,
  testId,
  onPick,
}: {
  day: string;
  label: string;
  selected: boolean;
  isToday: boolean;
  inRange: boolean;
  disabled: boolean;
  focusable: boolean;
  testId?: string;
  onPick: (day: string) => void;
}) {
  return (
    <button
      type="button"
      data-day={day}
      data-testid={testId}
      aria-label={label}
      aria-pressed={selected}
      aria-current={isToday ? 'date' : undefined}
      tabIndex={focusable ? 0 : -1}
      disabled={disabled}
      onClick={() => onPick(day)}
      className={cn(
        'mx-auto flex size-9 items-center justify-center rounded-md text-sm tabular-nums transition-colors',
        'disabled:cursor-not-allowed disabled:text-fg-faint disabled:opacity-50',
        selected
          ? 'bg-accent font-semibold text-accent-fg hover:bg-accent-hover'
          : inRange
            ? 'bg-accent-soft text-fg hover:bg-accent hover:text-accent-fg'
            : 'text-fg hover:bg-surface-sunken disabled:hover:bg-transparent',
        isToday &&
          !selected &&
          'font-semibold text-accent-strong ring-1 ring-accent-line ring-inset',
      )}
    >
      {parseDay(day).date}
    </button>
  );
}

function GridChoice({
  selected,
  disabled,
  testId,
  onClick,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  testId?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-10 rounded-md text-sm capitalize tabular-nums transition-colors',
        'disabled:cursor-not-allowed disabled:text-fg-faint disabled:opacity-50',
        selected
          ? 'bg-accent font-semibold text-accent-fg hover:bg-accent-hover'
          : 'text-fg hover:bg-surface-sunken disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function HeaderButton({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      data-testid={testId}
      onClick={onClick}
      className="rounded-md px-2 py-1 text-sm font-semibold capitalize tabular-nums transition-colors hover:bg-surface-sunken"
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  testId,
  disabled,
  onClick,
  children,
}: {
  label: string;
  testId?: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
