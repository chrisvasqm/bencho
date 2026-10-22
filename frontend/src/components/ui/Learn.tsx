import { BookOpen, X } from 'lucide-react';
import { m } from 'motion/react';
import type { ReactNode } from 'react';
import { Drawer } from 'vaul';
import { cn } from './cn.ts';

export interface LearnProps {
  /** Heading of the drawer; also the trigger's tooltip. */
  title: string;
  /** Visible trigger text, such as "Learn". */
  label: string;
  closeLabel: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}

/** A small "Learn" link that opens a bottom drawer with a short, plain-language explanation. */
export function Learn({ title, label, closeLabel, children, testId, className }: LearnProps) {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <m.button
          type="button"
          title={title}
          aria-label={`${label}: ${title}`}
          data-testid={testId}
          whileHover="active"
          whileFocus="active"
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-sm text-xs font-medium text-fg-muted transition-colors hover:text-accent',
            className,
          )}
        >
          <m.span className="inline-flex" variants={{ active: { rotate: -8, scale: 1.15 } }}>
            <BookOpen size={14} aria-hidden />
          </m.span>
          {label}
        </m.button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content
          // The title names the drawer; the body is read in order, so no separate description.
          aria-describedby={undefined}
          data-testid={testId && `${testId}-drawer`}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-lg border border-b-0 border-line bg-surface shadow-raised outline-none"
        >
          <div
            aria-hidden
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-line-strong"
          />
          <div className="flex items-start justify-between gap-4 px-5 pt-3">
            <Drawer.Title className="m-0 text-base font-semibold text-fg">{title}</Drawer.Title>
            <Drawer.Close
              aria-label={closeLabel}
              data-testid={testId && `${testId}-close`}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg"
            >
              <X size={16} aria-hidden />
            </Drawer.Close>
          </div>
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="flex flex-col gap-3 overflow-y-auto px-5 pt-2 pb-8 text-sm leading-relaxed text-fg-muted"
          >
            {children}
          </m.div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
