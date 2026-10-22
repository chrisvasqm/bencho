import { ArrowDown, ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn.ts';

export interface ScrollPaneProps {
  children: ReactNode;
  className?: string;
  /** Accessible names of the two jump buttons. */
  labels: { toTop: string; toBottom: string };
  testId?: string;
}

const EDGE_PX = 4;

/**
 * A scrolling column that says when there is more: a shadow along the bottom edge while content
 * continues below, a button to jump to the end, and one back to the top once scrolled.
 */
export function ScrollPane({ children, className, labels, testId }: ScrollPaneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ above: false, below: false });
  // Classic scrollbars take width; overlay ones (macOS default) take none.
  const [scrollbar, setScrollbar] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      setEdges({
        above: scrollTop > EDGE_PX,
        below: scrollTop + clientHeight < scrollHeight - EDGE_PX,
      });
      setScrollbar(element.offsetWidth - element.clientWidth);
    };
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    // Content changes height as charts load and runs finish.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  const jump = (top: number) => ref.current?.scrollTo({ top, behavior: 'smooth' });

  return (
    <div className={cn('relative min-h-0', className)}>
      <div
        ref={ref}
        data-testid={testId}
        className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto pr-1"
      >
        {children}
      </div>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 h-10 bg-linear-to-t from-overlay/52 to-transparent transition-opacity',
          edges.below ? 'opacity-100' : 'opacity-0',
        )}
        // Stops at the content edge: the pr-1 gutter (4px) plus any scrollbar.
        style={{ right: scrollbar + 4 }}
      />
      <div className="absolute bottom-3 flex flex-col gap-1.5" style={{ right: scrollbar + 16 }}>
        {edges.above && (
          <JumpButton label={labels.toTop} testId="scroll-to-top" onClick={() => jump(0)}>
            <ArrowUp size={16} aria-hidden />
          </JumpButton>
        )}
        {edges.below && (
          <JumpButton
            label={labels.toBottom}
            testId="scroll-to-bottom"
            onClick={() => jump(ref.current?.scrollHeight ?? 0)}
          >
            <ArrowDown size={16} aria-hidden />
          </JumpButton>
        )}
      </div>
    </div>
  );
}

function JumpButton({
  label,
  testId,
  onClick,
  children,
}: {
  label: string;
  testId: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-fg shadow-raised transition-colors hover:bg-surface-sunken"
    >
      {children}
    </button>
  );
}
