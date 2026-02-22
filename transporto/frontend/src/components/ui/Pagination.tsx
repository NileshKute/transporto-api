import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-light)] bg-[var(--bg-table-header)]">
      <p className="text-sm text-[var(--text-secondary)]">Showing {start}–{end} of {total}</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[var(--border-light)]"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          if (p < 1 || p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[36px] h-9 text-sm rounded-lg transition-colors ${
                p === page
                  ? 'bg-[var(--primary-600)] text-white font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-white border border-[var(--border-light)]'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-[var(--border-light)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
