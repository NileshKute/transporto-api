interface StatusBadgeProps { status: string; size?: 'sm' | 'md'; }

const statusMap: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  AVAILABLE:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  COMPLETED:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  RESOLVED:         { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  CLOSED:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  NORMAL:           { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  PRESENT:          { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  PROCESSED:        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  IN_PROGRESS:      { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  ON_TRIP:          { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  PROCESSING:       { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  ACKNOWLEDGED:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  SCHEDULED:        { bg: 'bg-slate-700/40',   text: 'text-slate-400',   dot: 'bg-slate-400' },
  IDLE:             { bg: 'bg-slate-700/40',   text: 'text-slate-400',   dot: 'bg-slate-400' },
  RECEIVED:         { bg: 'bg-slate-700/40',   text: 'text-slate-400',   dot: 'bg-slate-400' },
  IN_MAINTENANCE:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  WARNING:          { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400 animate-pulse' },
  EXPIRING_SOON:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  ON_LEAVE:         { bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  BREAKDOWN:        { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  CRITICAL:         { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400 animate-pulse' },
  PENDING:          { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  EXPIRED:          { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  FAILED:           { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  ABSENT:           { bg: 'bg-red-500/10',     text: 'text-red-400',     dot: 'bg-red-400' },
  CANCELLED:        { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  TERMINATED:       { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  OFFLINE:          { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  SOLD:             { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  NO_SHOW:          { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  IGNORED:          { bg: 'bg-slate-800/60',   text: 'text-slate-500',   dot: 'bg-slate-500' },
  OFF_DUTY:         { bg: 'bg-slate-700/40',   text: 'text-slate-400',   dot: 'bg-slate-400' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const s = statusMap[status] || { bg: 'bg-slate-700/40', text: 'text-slate-400', dot: 'bg-slate-400' };
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex items-center rounded-md font-semibold tracking-wide ${s.bg} ${s.text} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}
