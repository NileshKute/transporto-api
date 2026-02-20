import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
  trend?: { value: number; label?: string };
}

const colorMap = {
  blue:   { icon: 'bg-blue-500/10 text-blue-400',   border: 'border-blue-500/10' },
  green:  { icon: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/10' },
  amber:  { icon: 'bg-amber-500/10 text-amber-400',  border: 'border-amber-500/10' },
  red:    { icon: 'bg-red-500/10 text-red-400',      border: 'border-red-500/10' },
  purple: { icon: 'bg-purple-500/10 text-purple-400',border: 'border-purple-500/10' },
  cyan:   { icon: 'bg-cyan-500/10 text-cyan-400',    border: 'border-cyan-500/10' },
};

export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-[#111827] border border-[#1e293b] rounded-xl p-5 hover:border-[#334155] transition-colors`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</p>
          <p className="text-2xl font-bold text-slate-100">{value}</p>
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend.value)}% {trend.label || ''}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${c.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
