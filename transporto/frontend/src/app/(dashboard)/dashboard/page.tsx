'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatKm } from '@/lib/utils';
import { Truck, Users, Route, Fuel, Wrench, AlertTriangle, Shield, Thermometer, Clock, TrendingUp, Activity } from 'lucide-react';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: recent, isLoading: recentLoading } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => api.get('/dashboard/recent').then(r => r.data),
  });

  if (statsLoading) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      {/* Main KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Vehicles" value={stats?.vehicles?.total ?? 0} subtitle={`${stats?.vehicles?.active ?? 0} active`} icon={Truck} color="blue" />
        <StatCard title="Total Drivers" value={stats?.drivers?.total ?? 0} subtitle={`${stats?.drivers?.onTrip ?? 0} on trip`} icon={Users} color="green" />
        <StatCard title="Trips Today" value={stats?.trips?.today ?? 0} subtitle="Active trips" icon={Route} color="purple" />
        <StatCard title="Fuel Spend" value={formatCurrency(stats?.fuel?.totalCost)} subtitle="Total all-time" icon={Fuel} color="amber" />
      </div>

      {/* Alert Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10"><Wrench className="w-5 h-5 text-amber-400" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{stats?.maintenance?.active ?? 0}</p>
            <p className="text-xs text-slate-500">Active Maintenance</p>
          </div>
        </div>
        <div className="bg-[#111827] border border-red-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-red-500/10"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{stats?.emergencies?.pending ?? 0}</p>
            <p className="text-xs text-slate-500">Pending Emergencies</p>
          </div>
        </div>
        <div className="bg-[#111827] border border-orange-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-orange-500/10"><Shield className="w-5 h-5 text-orange-400" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{stats?.insurance?.expiring ?? 0}</p>
            <p className="text-xs text-slate-500">Expiring Insurance</p>
          </div>
        </div>
        <div className="bg-[#111827] border border-cyan-500/20 rounded-xl p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-cyan-500/10"><Thermometer className="w-5 h-5 text-cyan-400" /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{stats?.coldStorage?.alerts ?? 0}</p>
            <p className="text-xs text-slate-500">Cold Storage Alerts</p>
          </div>
        </div>
      </div>

      {/* Recent data tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl">
          <div className="px-5 py-4 border-b border-[#1e293b] flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2"><Route className="w-4 h-4 text-purple-400" /> Recent Trips</h3>
            <a href="/trips" className="text-xs text-blue-400 hover:text-blue-300">View all →</a>
          </div>
          {recentLoading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Trip #</th><th>Vehicle</th><th>Route</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent?.trips?.slice(0, 5).map((t: any) => (
                    <tr key={t.id}>
                      <td className="font-mono text-xs text-blue-400">{t.tripNumber}</td>
                      <td className="text-slate-300">{t.vehicle?.regNumber}</td>
                      <td className="text-slate-400 text-xs max-w-[140px] truncate">{t.startLocation} → {t.endLocation || '...'}</td>
                      <td><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                  {(!recent?.trips?.length) && <tr><td colSpan={4} className="text-center text-slate-600 py-8">No trips yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Fuel */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl">
          <div className="px-5 py-4 border-b border-[#1e293b] flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2"><Fuel className="w-4 h-4 text-amber-400" /> Recent Fuel Entries</h3>
            <a href="/fuel" className="text-xs text-blue-400 hover:text-blue-300">View all →</a>
          </div>
          {recentLoading ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th><th>Driver</th><th>Liters</th><th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent?.fuelEntries?.slice(0, 5).map((f: any) => (
                    <tr key={f.id}>
                      <td className="font-mono text-xs text-blue-400">{f.vehicle?.regNumber}</td>
                      <td className="text-slate-300">{f.driver?.name}</td>
                      <td className="text-slate-300">{f.liters}L</td>
                      <td className="text-emerald-400 font-medium">{formatCurrency(f.totalCost)}</td>
                    </tr>
                  ))}
                  {(!recent?.fuelEntries?.length) && <tr><td colSpan={4} className="text-center text-slate-600 py-8">No fuel entries yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Emergencies */}
      {recent?.emergencies?.length > 0 && (
        <div className="bg-[#111827] border border-red-500/20 rounded-xl">
          <div className="px-5 py-4 border-b border-red-500/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="font-semibold text-slate-100">Recent Emergencies</h3>
          </div>
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.emergencies.slice(0, 3).map((e: any) => (
              <div key={e.id} className="bg-[#0a0e1a] border border-[#1e293b] rounded-xl p-4 border-l-2 border-l-red-500">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-semibold text-red-400">{e.type.replace(/_/g,' ')}</span>
                  <StatusBadge status={e.status} />
                </div>
                <p className="text-xs text-slate-400">{e.vehicle?.regNumber} • {e.driver?.name}</p>
                {e.location && <p className="text-xs text-slate-500 mt-1">📍 {e.location}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
