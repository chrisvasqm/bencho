import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export interface NoteProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

/** A short, plain-language note on how a part of the app works. */
export function Note({ title, children, className }: NoteProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-line bg-surface-sunken px-3 py-2 text-xs leading-relaxed text-fg-muted',
        className,
      )}
    >
      {title && <p className="m-0 font-medium text-fg">{title}</p>}
      {children}
    </div>
  );
}
