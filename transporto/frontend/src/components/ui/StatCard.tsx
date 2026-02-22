import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  iconColor: 'blue' | 'green' | 'amber' | 'purple' | 'cyan' | 'red';
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
}

const colorMap = {
  blue: { bg: 'bg-blue-100', icon: 'text-blue-600' },
  green: { bg: 'bg-emerald-100', icon: 'text-emerald-600' },
  amber: { bg: 'bg-amber-100', icon: 'text-amber-600' },
  purple: { bg: 'bg-violet-100', icon: 'text-violet-600' },
  cyan: { bg: 'bg-cyan-100', icon: 'text-cyan-600' },
  red: { bg: 'bg-red-100', icon: 'text-red-600' },
};

export function StatCard({ icon: Icon, iconColor, title, value, subtitle, trend, trendDirection }: StatCardProps) {
  const c = colorMap[iconColor];
  const trendUp = trendDirection ? trendDirection === 'up' : (trend !== undefined && trend >= 0);
  return (
    <div className="bg-white rounded-xl p-5 border border-[#e2e8f0] shadow-sm hover:bg-[#f8fafc] transition-colors">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${c.bg} flex items-center justify-center ${c.icon}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[28px] font-bold mono text-[#0f172a] mt-3 leading-tight">{value}</p>
      <p className="text-[13px] text-[#475569] mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-[#94a3b8] mt-1">{subtitle}</p>}
    </div>
  );
}
