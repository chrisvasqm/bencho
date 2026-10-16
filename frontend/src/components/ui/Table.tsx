import type { ReactNode } from 'react';
import { cn } from './cn.ts';

export interface Column<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export interface TableProps<Row> {
  columns: ReadonlyArray<Column<Row>>;
  rows: ReadonlyArray<Row>;
  rowKey: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string;
  empty: string;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
}: TableProps<Row>) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-fg-muted">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-3 py-2 font-medium', column.align === 'right' && 'text-right')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = key === selectedKey;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                aria-selected={onRowClick ? selected : undefined}
                className={cn(
                  'border-b border-line last:border-b-0',
                  onRowClick && 'cursor-pointer hover:bg-surface-sunken',
                  selected && 'bg-accent-soft/50',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-3 py-2.5 align-middle',
                      column.align === 'right' && 'text-right tabular-nums',
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
