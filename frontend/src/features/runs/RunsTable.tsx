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
}

const HEADERS = [
  { label: 'Status' },
  { label: 'Target' },
  { label: 'Peak VUs', right: true },
  { label: 'p95', right: true },
  { label: 'Errors', right: true },
  { label: 'Started' },
];

export function RunsTable({ runs, loading, selectedId, onSelect, pageSize }: RunsTableProps) {
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
                className={`px-3 py-2 font-medium whitespace-nowrap ${header.right ? 'text-right' : ''}`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: Math.min(pageSize, 5) }, (_unused, index) => (
                <tr key={index} className="border-b border-line last:border-b-0">
                  {HEADERS.map((header) => (
                    <td key={header.label} className="px-3 py-3">
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
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
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
                        aria-label={`Show run from ${formatTime(run.createdAt)}`}
                        className="rounded-full"
                      >
                        <Badge tone={STATUS_TONES[run.status]} pulse={isActive(run.status)}>
                          {STATUS_LABELS[run.status]}
                        </Badge>
                      </button>
                    </td>
                    <td className="max-w-56 truncate px-3 py-2.5 font-mono text-xs">
                      {run.baseUrl}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {peakUsers(run.stages)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatMs(run.summary?.metrics.http_req_duration?.['p(95)'])}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {formatPercent(run.summary?.metrics.http_req_failed?.value)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-fg-muted">
                      {formatTime(run.createdAt)}
                    </td>
                  </motion.tr>
                );
              })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
