import { PackageOpen } from 'lucide-react';

export function EmptyState({ message = 'No data found', description }: { message?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1a2035] flex items-center justify-center mb-4">
        <PackageOpen className="w-8 h-8 text-slate-600" />
      </div>
      <p className="text-slate-400 font-medium">{message}</p>
      {description && <p className="text-slate-600 text-sm mt-1">{description}</p>}
    </div>
  );
}
