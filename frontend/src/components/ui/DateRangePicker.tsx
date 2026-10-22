import { DatePicker } from './DatePicker.tsx';
import { today } from './calendar.ts';

export interface DateRange {
  /** Calendar days as `YYYY-MM-DD`, empty when open-ended. */
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  labels: { from: string; to: string };
  /** Latest day that can be picked; today unless set. */
  max?: string;
  testIds?: { from: string; to: string };
}

/**
 * Two day fields that form a range: the start cannot pass the end, the end cannot come before
 * the start, and neither can pass `max` (today by default, so no future days).
 */
export function DateRangePicker({
  value,
  onChange,
  labels,
  max = today(),
  testIds,
}: DateRangePickerProps) {
  return (
    <div className="flex items-start gap-2">
      {/* Not <label>: it would forward clicks on the calendar to the field and close it. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fg-muted">
        <span aria-hidden>{labels.from}</span>
        <DatePicker
          label={labels.from}
          testId={testIds?.from}
          value={value.from}
          max={value.to && value.to < max ? value.to : max}
          range={value}
          onChange={(from) => onChange({ ...value, from })}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fg-muted">
        <span aria-hidden>{labels.to}</span>
        <DatePicker
          label={labels.to}
          testId={testIds?.to}
          value={value.to}
          min={value.from || undefined}
          max={max}
          align="end"
          range={value}
          onChange={(to) => onChange({ ...value, to })}
        />
      </div>
    </div>
  );
}
