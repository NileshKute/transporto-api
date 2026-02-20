'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Truck, Users, Route, Fuel, Wrench, AlertTriangle, Shield, Thermometer } from 'lucide-react';
import Link from 'next/link';

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold text-slate-300">{title}</h3>
      <Link href={href} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">View all →</Link>
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

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Vehicles" value={stats?.vehicles?.total ?? 0} subtitle={`${stats?.vehicles?.active ?? 0} active`} icon={Truck} color="blue" />
        <StatCard title="Total Drivers" value={stats?.drivers?.total ?? 0} subtitle={`${stats?.drivers?.onTrip ?? 0} on trip`} icon={Users} color="green" />
        <StatCard title="Trips Today" value={stats?.trips?.today ?? 0} subtitle="Active today" icon={Route} color="purple" />
        <StatCard title="Total Fuel Spend" value={formatCurrency(stats?.fuel?.totalCost)} subtitle="All time" icon={Fuel} color="amber" />
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Active Maintenance', value: stats?.maintenance?.active ?? 0, icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-500/8 border-amber-500/20', href: '/maintenance' },
          { label: 'Pending Emergencies', value: stats?.emergencies?.pending ?? 0, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/20', href: '/emergencies' },
          { label: 'Expiring Insurance', value: stats?.insurance?.expiring ?? 0, icon: Shield, color: 'text-orange-400', bg: 'bg-orange-500/8 border-orange-500/20', href: '/insurance' },
          { label: 'Cold Storage Alerts', value: stats?.coldStorage?.alerts ?? 0, icon: Thermometer, color: 'text-cyan-400', bg: 'bg-cyan-500/8 border-cyan-500/20', href: '/cold-storage' },
        ].map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <div className={`border rounded-xl p-4 flex items-center gap-4 card-hover cursor-pointer ${bg}`}>
              <div className={`p-2.5 rounded-xl bg-white/5`}><Icon className={`w-5 h-5 ${color}`} /></div>
              <div>
                <p className={`text-2xl font-bold ${value > 0 ? color : 'text-slate-300'}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid xl:grid-cols-2 gap-5">
        {/* Recent Trips */}
        <div className="bg-[#0d1424] border border-[#1a2235] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1a2235]">
            <SectionHeader title="Recent Trips" href="/trips" />
          </div>
          {rl ? <LoadingSpinner /> : (
            <table>
              <thead><tr><th>Trip #</th><th>Vehicle</th><th>Route</th><th>Status</th></tr></thead>
              <tbody>
                {recent?.trips?.slice(0, 5).map((t: any) => (
                  <tr key={t.id}>
                    <td><span className="font-mono text-xs font-bold text-blue-400">{t.tripNumber}</span></td>
                    <td><span className="font-mono text-xs text-slate-300">{t.vehicle?.regNumber}</span></td>
                    <td><span className="text-xs text-slate-500 truncate block max-w-[130px]">{t.startLocation?.split('(')[0].trim()} → {t.endLocation?.split('(')[0].trim() || '...'}</span></td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
                {!recent?.trips?.length && <tr><td colSpan={4} className="text-center py-8 text-slate-600 text-sm">No trips yet</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Fuel */}
        <div className="bg-[#0d1424] border border-[#1a2235] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1a2235]">
            <SectionHeader title="Recent Fuel Entries" href="/fuel" />
          </div>
          {rl ? <LoadingSpinner /> : (
            <table>
              <thead><tr><th>Vehicle</th><th>Driver</th><th>Liters</th><th>Cost</th></tr></thead>
              <tbody>
                {recent?.fuelEntries?.slice(0, 5).map((f: any) => (
                  <tr key={f.id}>
                    <td><span className="font-mono text-xs font-bold text-blue-400">{f.vehicle?.regNumber}</span></td>
                    <td className="text-sm text-slate-300">{f.driver?.name}</td>
                    <td className="text-slate-400">{f.liters}L</td>
                    <td><span className="font-semibold text-emerald-400">{formatCurrency(f.totalCost)}</span></td>
                  </tr>
                ))}
                {!recent?.fuelEntries?.length && <tr><td colSpan={4} className="text-center py-8 text-slate-600 text-sm">No fuel entries</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Emergencies (if any) */}
      {recent?.emergencies?.length > 0 && (
        <div className="bg-[#0d1424] border border-red-500/20 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-slate-300">Recent Emergencies</h3>
          </div>
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.emergencies.slice(0, 3).map((e: any) => (
              <div key={e.id} className="bg-[#0a0e1a] border border-[#1a2235] rounded-xl p-4 border-l-2 border-l-red-500">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-red-300">{e.type?.replace(/_/g,' ')}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-xs text-slate-500">{e.vehicle?.regNumber} • {e.driver?.name}</p>
                {e.location && <p className="text-xs text-slate-600 mt-1 truncate">📍 {e.location}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
