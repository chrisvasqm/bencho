// The run rail: one compact row per run, every type together, newest first. Each row shows the
// result, the type, when it ran, its p95 and the shape of that p95 over time.
import { AnimatePresence, m } from 'motion/react';
import type { Run } from '../../api/runs.ts';
import { Badge, Checkbox, Skeleton } from '../../components/ui/index.ts';
import { useCopy } from '../../i18n/useCopy.ts';
import { RunSparkline } from './RunSparkline.tsx';
import { STATUS_TONES, formatMs, formatPeak, formatTime, isActive } from './format.ts';

export interface RunListProps {
  runs: Run[];
  loading?: boolean;
  selectedId?: string;
  onSelect: (run: Run) => void;
  pageSize: number;
  /** Changes when a different page is shown: the list cross-fades as one. */
  listKey: string;
  /** Ids ticked to compare or delete. Runs in progress cannot be ticked. */
  checkedIds: ReadonlySet<string>;
  onCheckedChange: (ids: ReadonlySet<string>) => void;
}

// Fixed geometry: the list is always `pageSize` rows tall, so paging never resizes the rail.
const ROW_HEIGHT_PX = 56;

export function RunList({
  runs,
  loading,
  selectedId,
  onSelect,
  pageSize,
  listKey,
  checkedIds,
  onCheckedChange,
}: RunListProps) {
  const { t, language } = useCopy();
  const empty = !loading && runs.length === 0;

  const toggle = (run: Run) => {
    const next = new Set(checkedIds);
    if (next.has(run.id)) next.delete(run.id);
    else next.add(run.id);
    onCheckedChange(next);
  };
  return (
    <div className="relative" style={{ height: pageSize * ROW_HEIGHT_PX }}>
      {empty && (
        <p
          data-testid="runs-empty"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center text-sm text-fg-muted"
        >
          {t('runs.empty')}
        </p>
      )}
      <m.ul
        key={loading ? 'loading' : listKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        role="listbox"
        aria-label={t('app.runsTitle')}
        className="m-0 list-none p-0"
      >
        {loading
          ? Array.from({ length: pageSize }, (_unused, index) => (
              <li
                key={index}
                style={{ height: ROW_HEIGHT_PX }}
                className="flex items-center gap-3 border-b border-line px-4 last:border-b-0"
              >
                <Skeleton className="size-4" />
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-5 w-16" />
              </li>
            ))
          : null}
        <AnimatePresence initial={false}>
          {!loading &&
            runs.map((run) => {
              const selected = run.id === selectedId;
              const time = formatTime(run.createdAt, language);
              return (
                <m.li
                  key={run.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                  onClick={() => onSelect(run)}
                  role="option"
                  aria-selected={selected}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(run);
                    }
                  }}
                  data-testid="run-row"
                  data-run-id={run.id}
                  data-status={run.status}
                  data-type={run.type}
                  style={{ height: ROW_HEIGHT_PX }}
                  className={`flex cursor-pointer items-center gap-3 border-b border-line px-4 last:border-b-0 hover:bg-surface-sunken ${
                    selected
                      ? 'bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]'
                      : checkedIds.has(run.id)
                        ? 'bg-surface-sunken'
                        : ''
                  }`}
                >
                  <Checkbox
                    aria-label={t('runs.selectRun', { time })}
                    data-testid="run-row-checkbox"
                    checked={checkedIds.has(run.id)}
                    disabled={isActive(run.status)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => toggle(run)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(run);
                        }}
                        aria-label={t('runs.openRun', { status: t(`status.${run.status}`), time })}
                        className="rounded-full"
                      >
                        <Badge tone={STATUS_TONES[run.status]} pulse={isActive(run.status)}>
                          {t(`status.${run.status}`)}
                        </Badge>
                      </button>
                      <span
                        className="rounded-sm border border-line px-1 text-[11px] font-medium text-fg-muted"
                        data-testid="run-row-type"
                      >
                        {t(`runType.${run.type}`)}
                      </span>
                      <span
                        className="truncate text-[11px] text-fg-muted tabular-nums"
                        data-testid="run-peak"
                      >
                        {formatPeak(run, t)}
                      </span>
                    </div>
                    <span className="flex gap-1 font-mono text-[11px] text-fg-muted tabular-nums">
                      <span className="truncate">{time}</span>
                      <span className="shrink-0">
                        · {formatMs(run.summary?.metrics.http_req_duration?.['p(95)'])} ·{' '}
                        {formatPercent(run.summary?.metrics.http_req_failed?.value)}
                      </span>
                    </span>
                  </div>
                  <RunSparkline run={run} width={56} />
                </m.li>
              );
            })}
        </AnimatePresence>
      </m.ul>
    </div>
  );
}
