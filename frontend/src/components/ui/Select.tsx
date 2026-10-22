import { ChevronDown } from 'lucide-react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from './cn.ts';
import { inputClasses } from './Input.tsx';

export interface SelectOption<Value extends string = string> {
  value: Value;
  label: string;
}

export interface SelectProps<Value extends string = string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'value'
> {
  options: ReadonlyArray<SelectOption<Value>>;
  value: Value;
  onChange: (value: Value) => void;
}

export function Select<Value extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: SelectProps<Value>) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Value)}
        className={cn(inputClasses, 'peer cursor-pointer appearance-none pr-8')}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted peer-disabled:text-fg-faint"
      />
    </div>
  );
}
