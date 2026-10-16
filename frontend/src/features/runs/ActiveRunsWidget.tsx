// Floating card that follows runs in progress once the Runs card is scrolled out of view.
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type RefObject } from 'react';
import { runsApi, type Run } from '../../api/runs.ts';
import { Badge } from '../../components/ui/index.ts';
import {
  RUN_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  durationToSeconds,
  peakUsers,
} from './format.ts';

const ACTIVE_POLL_MS = 2000;
const IDLE_POLL_MS = 10000;

export interface ActiveRunsWidgetProps {
  /** The Runs card. The widget shows only while it is out of view. */
  anchorRef: RefObject<HTMLElement | null>;
  onOpen: (run: Run) => void;
}

function useOutOfView(ref: RefObject<HTMLElement | null>): boolean {
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // No root: intersection with the viewport, clipped by scrolling ancestors such as the
    // results column on wide screens.
    const observer = new IntersectionObserver(([entry]) => setOutOfView(!entry?.isIntersecting), {
      threshold: 0,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return outOfView;
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function ActiveRunsWidget({ anchorRef, onOpen }: ActiveRunsWidgetProps) {
  const outOfView = useOutOfView(anchorRef);
  const active = useQuery({
    queryKey: ['runs', 'active'],
    queryFn: runsApi.active,
    refetchInterval: (query) => (query.state.data?.runs.length ? ACTIVE_POLL_MS : IDLE_POLL_MS),
  });
  const runs = active.data?.runs ?? [];
  const visible = outOfView && runs.length > 0;
  const now = useNow(visible);

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          aria-label="Runs in progress"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="fixed right-[max(16px,env(safe-area-inset-right))] bottom-[max(16px,env(safe-area-inset-bottom))] z-40 w-[min(320px,calc(100vw-32px))] rounded-lg bg-surface p-3 shadow-raised ring-1 ring-line"
        >
          <p className="mb-2 text-xs text-fg-muted">
            {runs.length === 1 ? '1 run in progress' : `${runs.length} runs in progress`}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {runs.map((run) => {
              const planned = run.stages.reduce(
                (total, stage) => total + (durationToSeconds(stage.duration) || 0),
                0,
              );
              const elapsed = run.startedAt ? (now - new Date(run.startedAt).getTime()) / 1000 : 0;
              const progress = planned > 0 ? Math.min(1, elapsed / planned) : 0;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(run)}
                    className="flex w-full flex-col gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-surface-sunken"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Badge tone={STATUS_TONES[run.status]} pulse>
                        {STATUS_LABELS[run.status]}
                      </Badge>
                      <span className="font-medium text-fg">{RUN_TYPE_LABELS[run.type]}</span>
                      <span className="text-fg-muted tabular-nums">
                        {peakUsers(run.stages)} VUs
                      </span>
                      <span className="ml-auto text-xs text-fg-muted tabular-nums">
                        {formatClock(elapsed)} / {formatClock(planned)}
                      </span>
                    </span>
                    <span
                      className="block h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
                      role="progressbar"
                      aria-label={`${RUN_TYPE_LABELS[run.type]} run progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(progress * 100)}
                    >
                      <span
                        className="block h-full rounded-full bg-accent-line transition-[width] duration-1000 ease-linear"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
