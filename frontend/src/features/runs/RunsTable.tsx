import { AnimatePresence, m } from 'motion/react';
import type { Run } from '../../api/runs.ts';
import { Badge, Checkbox, Skeleton } from '../../components/ui/index.ts';
import {
  STATUS_LABELS,
  STATUS_TONES,
  formatMs,
  formatPercent,
  formatTime,
  isActive,
  formatPeak,
} from './format.ts';

export interface RunsTableProps {
  runs: Run[];
  loading?: boolean;
  selectedId?: string;
  onSelect: (run: Run) => void;
  pageSize: number;
  /** Changes when a different list is shown (type or page): the body cross-fades as one. */
  listKey: string;
  /** Ids ticked for bulk actions. Runs in progress cannot be ticked. */
  checkedIds: ReadonlySet<string>;
  onCheckedChange: (ids: ReadonlySet<string>) => void;
}

// Fixed geometry: the table area is always `pageSize` rows tall, so switching type or page
// never resizes the card. More runs than fit go to the next page.
const ROW_HEIGHT_PX = 34;
const HEAD_HEIGHT_PX = 36;

const HEADERS = [
  { label: 'Status' },
  { label: 'Target', wide: true },
  { label: 'Peak', right: true },
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
  checkedIds,
  onCheckedChange,
}: RunsTableProps) {
  const empty = !loading && runs.length === 0;
  const checkable = runs.filter((run) => !isActive(run.status));
  const checkedOnPage = checkable.filter((run) => checkedIds.has(run.id)).length;
  const allChecked = checkable.length > 0 && checkedOnPage === checkable.length;

  const toggle = (run: Run) => {
    const next = new Set(checkedIds);
    if (next.has(run.id)) next.delete(run.id);
    else next.add(run.id);
    onCheckedChange(next);
  };
  const toggleAll = () => {
    const next = new Set(checkedIds);
    for (const run of checkable) {
      if (allChecked) next.delete(run.id);
      else next.add(run.id);
    }
    onCheckedChange(next);
  };
  return (
    <div
      className="relative overflow-x-auto overflow-y-hidden"
      style={{ height: HEAD_HEIGHT_PX + pageSize * ROW_HEIGHT_PX }}
    >
      {empty && (
        <p
          data-testid="runs-empty"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-fg-muted"
        >
          No runs of this type yet. Start one from the panel.
        </p>
      )}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr
            style={{ height: HEAD_HEIGHT_PX }}
            className="border-b border-line text-left text-xs text-fg-muted"
          >
            <th scope="col" className="w-10 px-3 py-0">
              <Checkbox
                aria-label="Select all finished runs on this page"
                data-testid="select-all-runs"
                checked={allChecked}
                indeterminate={checkedOnPage > 0 && !allChecked}
                disabled={loading || checkable.length === 0}
                onChange={toggleAll}
              />
            </th>
            {HEADERS.map((header) => (
              <th
                key={header.label}
                scope="col"
                className={`px-3 py-0 font-medium whitespace-nowrap ${header.right ? 'text-right' : ''} ${header.wide ? 'hidden sm:table-cell' : ''}`}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <m.tbody
          key={loading ? 'loading' : listKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {loading
            ? Array.from({ length: pageSize }, (_unused, index) => (
                <tr
                  key={index}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="w-10 px-3 py-0" />
                  {HEADERS.map((header) => (
                    <td
                      key={header.label}
                      className={`px-3 py-0 ${header.wide ? 'hidden sm:table-cell' : ''}`}
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
                  <m.tr
                    key={run.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                    onClick={() => onSelect(run)}
                    aria-selected={selected}
                    data-testid="run-row"
                    data-run-id={run.id}
                    data-status={run.status}
                    style={{ height: ROW_HEIGHT_PX }}
                    className={`cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-sunken ${selected ? 'bg-accent-soft' : checkedIds.has(run.id) ? 'bg-surface-sunken' : ''}`}
                  >
                    <td className="w-10 px-3 py-0" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select run from ${formatTime(run.createdAt)}`}
                        data-testid="run-row-checkbox"
                        checked={checkedIds.has(run.id)}
                        disabled={isActive(run.status)}
                        onChange={() => toggle(run)}
                      />
                    </td>
                    <td className="px-3 py-0">
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
                    <td className="hidden max-w-56 truncate px-3 py-0 sm:table-cell text-xs">
                      {run.baseUrl}
                    </td>
                    <td className="px-3 py-0 text-right tabular-nums" data-testid="run-peak">
                      {formatPeak(run)}
                    </td>
                    <td className="px-3 py-0 text-right tabular-nums whitespace-nowrap">
                      {formatMs(run.summary?.metrics.http_req_duration?.['p(95)'])}
                    </td>
                    <td className="px-3 py-0 text-right tabular-nums">
                      {formatPercent(run.summary?.metrics.http_req_failed?.value)}
                    </td>
                    <td className="hidden px-3 py-0 whitespace-nowrap text-fg-muted sm:table-cell">
                      {formatTime(run.createdAt)}
                    </td>
                  </m.tr>
                );
              })}
          </AnimatePresence>
        </m.tbody>
      </table>
    </div>
  );
}
