import { cn } from './cn.ts';

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  options: ReadonlyArray<SegmentedOption<Value>>;
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  size?: 'sm' | 'md';
  /** Fills the row; the options split it evenly. */
  fullWidth?: boolean;
  /** Prefix for test ids: each option gets `${testId}-${value}`. */
  testId?: string;
}

/** A small set of exclusive choices shown side by side, like a theme or view switch. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  fullWidth = false,
  testId,
}: SegmentedControlProps<Value>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'rounded-md bg-surface-sunken p-0.5',
        fullWidth ? 'flex w-full' : 'inline-flex',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={testId && `${testId}-${option.value}`}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[5px] font-medium transition-colors',
              fullWidth && 'flex-1',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              selected ? 'bg-surface text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
