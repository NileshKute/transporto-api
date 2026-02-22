import { PackageOpen } from 'lucide-react';

export function EmptyState({ message = 'No data found', description }: { message?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-table-header)] flex items-center justify-center mb-4">
        <PackageOpen className="w-8 h-8 text-[var(--text-muted)]" />
      </div>
      <p className="text-[var(--text-secondary)] font-medium">{message}</p>
      {description && <p className="text-[var(--text-muted)] text-sm mt-1">{description}</p>}
    </div>
  );
}
