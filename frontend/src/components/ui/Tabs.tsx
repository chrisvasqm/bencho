import { cn } from './cn.ts';

export interface TabItem<Value extends string> {
  value: Value;
  label: string;
  count?: number;
}

export interface TabsProps<Value extends string> {
  items: ReadonlyArray<TabItem<Value>>;
  value: Value;
  onChange: (value: Value) => void;
  label: string;
}

export function Tabs<Value extends string>({ items, value, onChange, label }: TabsProps<Value>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line">
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              selected
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="rounded-full bg-surface-sunken px-1.5 font-mono text-xs tabular-nums text-fg-muted">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
