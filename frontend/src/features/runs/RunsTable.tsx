import { Badge, Table, type Column } from '../../components/ui/index.ts';
import type { Run } from '../../api/runs.ts';
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
  selectedId?: string;
  onSelect: (run: Run) => void;
}

const columns: Column<Run>[] = [
  {
    key: 'status',
    header: 'Status',
    render: (run) => (
      <Badge tone={STATUS_TONES[run.status]} pulse={isActive(run.status)}>
        {STATUS_LABELS[run.status]}
      </Badge>
    ),
  },
  {
    key: 'target',
    header: 'Target',
    className: 'max-w-64 truncate font-mono text-xs',
    render: (run) => run.baseUrl,
  },
  { key: 'peak', header: 'Peak VUs', align: 'right', render: (run) => peakUsers(run.stages) },
  {
    key: 'p95',
    header: 'p95',
    align: 'right',
    render: (run) => formatMs(run.summary?.metrics.http_req_duration?.['p(95)']),
  },
  {
    key: 'errors',
    header: 'Errors',
    align: 'right',
    render: (run) => formatPercent(run.summary?.metrics.http_req_failed?.value),
  },
  {
    key: 'when',
    header: 'Started',
    render: (run) => <span className="text-fg-muted">{formatTime(run.createdAt)}</span>,
  },
];

export function RunsTable({ runs, selectedId, onSelect }: RunsTableProps) {
  return (
    <Table
      columns={columns}
      rows={runs}
      rowKey={(run) => run.id}
      selectedKey={selectedId}
      onRowClick={onSelect}
      empty="No runs of this type yet. Start one from the form."
    />
  );
}
