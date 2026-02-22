interface StatusBadgeProps { status: string; size?: 'sm' | 'md'; }

const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:           { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  AVAILABLE:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  COMPLETED:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  RESOLVED:         { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  CLOSED:           { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  NORMAL:           { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PRESENT:          { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PROCESSED:        { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  IN_PROGRESS:      { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  ON_TRIP:          { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  PROCESSING:       { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  ACKNOWLEDGED:     { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  SCHEDULED:        { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-500' },
  IDLE:             { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-500' },
  RECEIVED:         { bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-500' },
  IN_MAINTENANCE:   { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  WARNING:          { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  EXPIRING_SOON:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  ON_LEAVE:         { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  BREAKDOWN:        { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  CRITICAL:         { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  PENDING:          { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  EXPIRED:          { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  FAILED:           { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  ABSENT:           { bg: 'bg-red-50',     text: 'text-red-700',      dot: 'bg-red-500' },
  CANCELLED:        { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  TERMINATED:       { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  OFFLINE:          { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  SOLD:             { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  NO_SHOW:          { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  IGNORED:          { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
  OFF_DUTY:         { bg: 'bg-slate-100',  text: 'text-slate-500',    dot: 'bg-slate-400' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const s = statusMap[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-md font-semibold tracking-wide ${s.bg} ${s.text} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
