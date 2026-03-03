interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  AVAILABLE:       { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  COMPLETED:       { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  RESOLVED:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  NORMAL:          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  IN_PROGRESS:     { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  ON_TRIP:         { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  PROCESSING:      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  SCHEDULED:       { bg: 'bg-slate-50',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  IDLE:            { bg: 'bg-slate-50',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  IN_MAINTENANCE:  { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  WARNING:         { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  EXPIRING_SOON:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  CRITICAL:        { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  BREAKDOWN:       { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  PENDING:         { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  EXPIRED:         { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  CANCELLED:       { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  TERMINATED:      { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  OFFLINE:         { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  RECEIVED:        { bg: 'bg-slate-50',   text: 'text-slate-700',   dot: 'bg-slate-400' },
  PROCESSED:       { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  FAILED:          { bg: 'bg-red-50',      text: 'text-red-700',     dot: 'bg-red-500' },
  IGNORED:         { bg: 'bg-gray-50',    text: 'text-gray-600',    dot: 'bg-gray-400' },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
  const sizeClass = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium border border-transparent ${config.bg} ${config.text} ${sizeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${
        status === 'WARNING' || status === 'CRITICAL' ? 'animate-pulse' : ''
      }`}></span>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
