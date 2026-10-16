import { Button } from './Button.tsx';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({ page, pageSize, total, onPageChange, loading }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p data-testid="pagination-range" className="text-xs text-fg-muted tabular-nums">
        {total === 0 ? 'No runs' : `${first}–${last} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          data-testid="pagination-previous"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span data-testid="pagination-page" className="text-xs text-fg-muted tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="secondary"
          size="sm"
          data-testid="pagination-next"
          disabled={page >= pageCount || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
