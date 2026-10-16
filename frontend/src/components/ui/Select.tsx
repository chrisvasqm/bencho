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
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Value)}
      className={cn(inputClasses, 'appearance-none pr-8', className)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
