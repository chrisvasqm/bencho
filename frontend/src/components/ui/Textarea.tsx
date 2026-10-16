import type { TextareaHTMLAttributes } from 'react';
import { cn } from './cn.ts';
import { inputClasses } from './Input.tsx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  mono?: boolean;
}

export function Textarea({ invalid, mono, className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        inputClasses,
        'h-auto resize-y py-2 leading-relaxed',
        mono && 'font-mono text-xs',
        invalid && 'border-danger focus:border-danger',
        className,
      )}
      {...rest}
    />
  );
}
