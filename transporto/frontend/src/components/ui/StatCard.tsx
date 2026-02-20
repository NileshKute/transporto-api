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
  blue:   { icon: 'bg-blue-500/15 text-blue-400',     glow: 'shadow-blue-500/10' },
  green:  { icon: 'bg-emerald-500/15 text-emerald-400', glow: 'shadow-emerald-500/10' },
  amber:  { icon: 'bg-amber-500/15 text-amber-400',   glow: 'shadow-amber-500/10' },
  red:    { icon: 'bg-red-500/15 text-red-400',       glow: 'shadow-red-500/10' },
  purple: { icon: 'bg-purple-500/15 text-purple-400', glow: 'shadow-purple-500/10' },
  cyan:   { icon: 'bg-cyan-500/15 text-cyan-400',     glow: 'shadow-cyan-500/10' },
};

export function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`bg-[#111827] border border-[#1e293b] rounded-xl p-5 card-hover`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <div className={`p-2.5 rounded-xl ${c.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend.value)}% {trend.label || ''}
        </div>
      )}
    </div>
  );
}
