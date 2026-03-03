'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { LoadingSpinner, TableSkeleton } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Truck, Users, Route, Fuel, Wrench, AlertTriangle, Shield, Snowflake } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CHART_COLORS = { primary: '#3b82f6', secondary: '#8b5cf6', success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#0ea5e9' };
const tooltipStyle = { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px', fontSize: '13px' };

const weeklyTripData = [{ day: 'Mon', trips: 12 }, { day: 'Tue', trips: 19 }, { day: 'Wed', trips: 8 }, { day: 'Thu', trips: 15 }, { day: 'Fri', trips: 22 }, { day: 'Sat', trips: 10 }, { day: 'Sun', trips: 5 }];
const vehicleStatusData = [
  { name: 'Active', value: 28, color: CHART_COLORS.success },
  { name: 'Maintenance', value: 5, color: CHART_COLORS.warning },
  { name: 'Idle', value: 12, color: '#64748b' },
  { name: 'Breakdown', value: 2, color: CHART_COLORS.danger },
];

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <Link href={href} className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">View all →</Link>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: sl } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: recent, isLoading: rl } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => api.get('/dashboard/recent').then(r => r.data),
  });

  if (sl) return <LoadingSpinner text="Loading dashboard..." />;

  const pendingEmergencies = stats?.emergencies?.pending ?? recent?.emergencies?.filter((e: any) => e.status === 'PENDING' || e.status === 'ACKNOWLEDGED').length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Truck} iconColor="blue" title="Total Vehicles" value={stats?.vehicles?.total ?? 0} subtitle={`${stats?.vehicles?.active ?? 0} active`} trend={12} trendDirection="up" />
        <StatCard icon={Users} iconColor="green" title="Active Drivers" value={stats?.drivers?.total ?? 0} subtitle={`${stats?.drivers?.onTrip ?? 0} on trip`} trend={5} trendDirection="up" />
        <StatCard icon={Route} iconColor="purple" title="Today's Trips" value={stats?.trips?.today ?? 0} subtitle="Active today" trend={-3} trendDirection="down" />
        <StatCard icon={Fuel} iconColor="amber" title="Fuel Spend" value={formatCurrency(stats?.fuel?.totalCost)} subtitle="All time" />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Active Maintenance', value: stats?.maintenance?.active ?? 0, icon: Wrench, border: 'border-l-amber-500', iconClass: 'text-amber-600', href: '/maintenance' },
          { label: 'Pending Emergencies', value: stats?.emergencies?.pending ?? 0, icon: AlertTriangle, border: 'border-l-red-500', iconClass: 'text-red-600', href: '/emergencies' },
          { label: 'Expiring Insurance', value: stats?.insurance?.expiring ?? 0, icon: Shield, border: 'border-l-orange-500', iconClass: 'text-orange-600', href: '/insurance' },
          { label: 'Cold Storage Alerts', value: stats?.coldStorage?.alerts ?? 0, icon: Snowflake, border: 'border-l-cyan-500', iconClass: 'text-cyan-600', href: '/cold-storage' },
        ].map(({ label, value, icon: Icon, border, iconClass, href }) => (
          <Link key={label} href={href}>
            <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${border} p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer`}>
              <div className={`p-2.5 rounded-xl bg-gray-100 ${iconClass}`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className={`text-2xl font-bold font-mono ${value > 0 ? iconClass : 'text-slate-400'}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Weekly Trip Activity</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyTripData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Bar dataKey="trips" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Vehicle Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                {vehicleStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Trips & Fuel */}
      <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <SectionHeader title="Recent Trips" href="/trips" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Trip #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Route</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent?.trips?.slice(0, 5).map((t: any) => (
                    <tr key={t.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-slate-700"><span className="font-mono font-bold text-blue-600">{t.tripNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-slate-700"><span className="font-mono">{t.vehicle?.regNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 truncate max-w-[160px]">{t.startLocation?.split('(')[0].trim()} → {t.endLocation?.split('(')[0].trim() || '...'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                  {!recent?.trips?.length && <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">No trips yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <SectionHeader title="Recent Fuel Entries" href="/fuel" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Liters</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cost</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent?.fuelEntries?.slice(0, 5).map((f: any) => (
                    <tr key={f.id} className="hover:bg-blue-50/50 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-slate-700 font-mono font-semibold">{f.vehicle?.regNumber}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 font-mono">{f.liters} L</td>
                      <td className="px-4 py-3.5 text-sm text-slate-700 font-mono font-semibold text-emerald-600">{formatCurrency(f.totalCost)}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(f.fuelDate)}</td>
                    </tr>
                  ))}
                  {!recent?.fuelEntries?.length && <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">No fuel entries</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Emergency Banner */}
      {pendingEmergencies > 0 && (
        <AlertBanner
          type="danger"
          title={`${pendingEmergencies} Active Emergency${pendingEmergencies > 1 ? 's' : ''} Require Attention`}
          action={{ label: 'View All', onClick: () => window.location.href = '/emergencies' }}
        />
      )}
    </div>
  );
}
