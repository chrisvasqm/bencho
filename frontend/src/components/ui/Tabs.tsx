import { cn } from './cn.ts';

export interface TabItem<Value extends string> {
  value: Value;
  label: string;
  count?: number;
  /** Marks the tab as needing attention, e.g. a form error inside it. */
  alert?: boolean;
}

export interface TabsProps<Value extends string> {
  items: ReadonlyArray<TabItem<Value>>;
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  /** Prefix for test ids: each tab gets `${testId}-${value}`. */
  testId?: string;
}

export function Tabs<Value extends string>({
  items,
  value,
  onChange,
  label,
  testId,
}: TabsProps<Value>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid w-full auto-cols-fr grid-flow-col rounded-md bg-surface-sunken p-1"
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={testId && `${testId}-${item.value}`}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              selected ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg',
            )}
          >
            {item.label}
            {item.alert && (
              <span
                role="img"
                aria-label="has errors"
                data-testid={testId && `${testId}-${item.value}-alert`}
                className="size-1.5 rounded-full bg-danger"
              />
            )}
            {item.count !== undefined && (
              <span className="rounded-full bg-surface-sunken px-1.5 text-xs tabular-nums text-fg-muted">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
