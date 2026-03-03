import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  iconColor: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan';
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendDirection?: 'up' | 'down';
}

const colorMap = {
  blue:   { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100' },
  green:  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  purple: { bg: 'bg-purple-50',  text: 'text-purple-600',  ring: 'ring-purple-100' },
  amber:  { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
  red:    { bg: 'bg-red-50',     text: 'text-red-600',     ring: 'ring-red-100' },
  cyan:   { bg: 'bg-cyan-50',    text: 'text-cyan-600',    ring: 'ring-cyan-100' },
};

export function StatCard({ icon: Icon, iconColor, title, value, subtitle, trend, trendDirection }: StatCardProps) {
  const c = colorMap[iconColor] || colorMap.blue;
  const trendUp = trendDirection ? trendDirection === 'up' : (trend !== undefined && trend >= 0);

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${c.text}`} />
        </div>
        {trend !== undefined && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
            trendUp ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
          }`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900 font-mono">{value}</p>
        <p className="text-sm font-medium text-slate-500 mt-1">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
