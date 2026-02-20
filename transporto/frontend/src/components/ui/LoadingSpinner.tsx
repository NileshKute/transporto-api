import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
      <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-4 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="skeleton h-32 w-full rounded-xl" />;
}
