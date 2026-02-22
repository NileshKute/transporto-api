import { PackageOpen } from 'lucide-react';

export function EmptyState({ message = 'No data found', description }: { message?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#f1f5f9] flex items-center justify-center mb-4">
        <PackageOpen className="w-8 h-8 text-[#94a3b8]" />
      </div>
      <p className="text-[#475569] font-medium">{message}</p>
      {description && <p className="text-[#94a3b8] text-sm mt-1">{description}</p>}
    </div>
  );
}
