import { AnimatePresence, motion } from 'motion/react';
import type { Run } from '../../api/runs.ts';
import { Badge, Skeleton } from '../../components/ui/index.ts';
import {
  STATUS_LABELS,
  STATUS_TONES,
  formatMs,
  formatPercent,
  formatTime,
  isActive,
  peakUsers,
} from './format.ts';

export interface RunsTableProps {
  runs: Run[];
  loading?: boolean;
  selectedId?: string;
  onSelect: (run: Run) => void;
  pageSize: number;
  /** Changes when a different list is shown (type or page): the body cross-fades as one. */
  listKey: string;
}

const HEADERS = [
  { label: 'Status' },
  { label: 'Target', wide: true },
  { label: 'Peak VUs', right: true },
  { label: 'p95', right: true },
  { label: 'Errors', right: true },
  { label: 'Started', wide: true },
];

export function RunsTable({
  runs,
  loading,
  selectedId,
  onSelect,
  pageSize,
  listKey,
}: RunsTableProps) {
  if (!loading && runs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-fg-muted">
        No runs of this type yet. Start one from the panel.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-fg-muted">
            {HEADERS.map((header) => (
              <th
                key={header.label}
                scope="col"
                className={`px-3 py-2 font-medium whitespace-nowrap ${header.right ? 'text-right' : ''} ${header.wide ? 'hidden sm:table-cell' : ''}`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody
          key={loading ? 'loading' : listKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {loading
            ? Array.from({ length: Math.min(pageSize, 5) }, (_unused, index) => (
                <tr key={index} className="border-b border-line last:border-b-0">
                  {HEADERS.map((header) => (
                    <td
                      key={header.label}
                      className={`px-3 py-3 ${header.wide ? 'hidden sm:table-cell' : ''}`}
                    >
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          <AnimatePresence initial={false}>
            {!loading &&
              runs.map((run) => {
                const selected = run.id === selectedId;
                return (
                  <motion.tr
                    key={run.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    onClick={() => onSelect(run)}
                    aria-selected={selected}
                    className={`cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-sunken ${selected ? 'bg-accent-soft' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(run);
                        }}
                        aria-label={`${STATUS_LABELS[run.status]}, run from ${formatTime(run.createdAt)}`}
                        className="rounded-full"
                      >
                        <Badge tone={STATUS_TONES[run.status]} pulse={isActive(run.status)}>
                          {STATUS_LABELS[run.status]}
                        </Badge>
                      </button>
                    </td>
                    <td className="hidden max-w-56 truncate px-3 py-2.5 sm:table-cell text-xs">
                      {run.baseUrl}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{peakUsers(run.stages)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {formatMs(run.summary?.metrics.http_req_duration?.['p(95)'])}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatPercent(run.summary?.metrics.http_req_failed?.value)}
                    </td>
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-fg-muted sm:table-cell">
                      {formatTime(run.createdAt)}
                    </td>
                  </motion.tr>
                );
              })}
          </AnimatePresence>
        </motion.tbody>
      </table>
    </div>
  );
}
