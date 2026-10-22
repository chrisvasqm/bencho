import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from './cn.ts';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Extra header content under the title row, e.g. tabs. */
  headerExtra?: ReactNode;
  /** Pinned under the body, e.g. the primary action. */
  footer?: ReactNode;
  /** Body scrolls inside the card while header and footer stay visible. Give the card a height. */
  scrollBody?: boolean;
  /** Footer without padding, so its content (e.g. a block button) fills it. */
  flushFooter?: boolean;
  bodyClassName?: string;
  ref?: Ref<HTMLElement>;
}

export function Card({
  title,
  description,
  actions,
  headerExtra,
  footer,
  scrollBody,
  flushFooter,
  className,
  bodyClassName,
  children,
  ...rest
}: CardProps) {
  return (
    <section className={cn('flex flex-col rounded-lg bg-surface', className)} {...rest}>
      {(title || actions || headerExtra) && (
        <header className="flex shrink-0 flex-col gap-3 px-5 pt-5 pb-2">
          {(title || actions) && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {title && <h2 className="text-base font-semibold text-fg">{title}</h2>}
                {description && (
                  <p className="mt-0.5 truncate text-sm text-fg-muted">{description}</p>
                )}
              </div>
              {actions}
            </div>
          )}
          {headerExtra}
        </header>
      )}
      <div
        className={cn('px-5 py-4', scrollBody && 'relative min-h-0 flex-1 overflow-y-auto', bodyClassName)}
      >
        {children}
      </div>
      {footer && (
        <footer
          className={cn(
            'shrink-0 rounded-b-lg bg-surface-sunken',
            flushFooter ? 'flex' : 'px-5 py-3',
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  );
}
