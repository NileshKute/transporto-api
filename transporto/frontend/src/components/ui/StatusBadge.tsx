interface StatusBadgeProps { status: string; size?: 'sm' | 'md'; }

const statusMap: Record<string, string> = {
  // Green
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  AVAILABLE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  COMPLETED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  RESOLVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  CLOSED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  NORMAL: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  PRESENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  PROCESSED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  // Blue
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  ON_TRIP: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PROCESSING: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  ACKNOWLEDGED: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  // Slate
  SCHEDULED: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  IDLE: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  RECEIVED: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  // Amber
  IN_MAINTENANCE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  WARNING: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  EXPIRING_SOON: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  ON_LEAVE: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  HALF_DAY: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  // Red
  BREAKDOWN: 'bg-red-500/15 text-red-400 border-red-500/20',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/20',
  PENDING: 'bg-red-500/15 text-red-400 border-red-500/20',
  EXPIRED: 'bg-red-500/15 text-red-400 border-red-500/20',
  FAILED: 'bg-red-500/15 text-red-400 border-red-500/20',
  // Gray
  CANCELLED: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  TERMINATED: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  OFFLINE: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  DECOMMISSIONED: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  SOLD: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  NO_SHOW: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  IGNORED: 'bg-slate-600/15 text-slate-500 border-slate-600/20',
  ABSENT: 'bg-red-500/15 text-red-400 border-red-500/20',
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const classes = statusMap[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/20';
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${classes} ${padding}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
