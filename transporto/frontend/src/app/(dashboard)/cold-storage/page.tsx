'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thermometer, AlertTriangle, Users, Zap } from 'lucide-react';
import Link from 'next/link';

const tempColor = (status: string) => {
  if (status === 'CRITICAL') return 'text-red-400';
  if (status === 'WARNING') return 'text-amber-400';
  return 'text-emerald-400';
};
const statusDot = (status: string) => {
  if (status === 'CRITICAL') return 'bg-red-500';
  if (status === 'WARNING') return 'bg-amber-500 animate-pulse';
  if (status === 'OFFLINE') return 'bg-slate-500';
  return 'bg-emerald-500';
};

export default function ColdStoragePage() {
  const { data: units, isLoading } = useQuery({
    queryKey: ['cold-storage'],
    queryFn: () => api.get('/cold-storage').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: alerts } = useQuery({
    queryKey: ['cold-storage-alerts'],
    queryFn: () => api.get('/cold-storage/alerts').then(r => r.data),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Cold Storage</h2>
        <p className="text-sm text-slate-500">Monitor temperature and storage units</p>
      </div>

      {/* Alert Banner */}
      {alerts?.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-400">{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-300">{a.unit?.name} — {a.alertType.replace(/_/g,' ')}</span>
                <span className="text-slate-400 text-xs">{a.temperature ? `${a.temperature}°C` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Units Grid */}
      {isLoading ? <LoadingSpinner /> : !units?.length ? <EmptyState message="No cold storage units" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {units.map((u: any) => {
            const latestTemp = u.temperatureLogs?.[0]?.temperature;
            const capacityUsed = u.storageClients?.reduce((acc: number, c: any) => acc + (c.spaceUsed || 0), 0) || 0;
            const capacityPct = Math.min(100, Math.round((capacityUsed / u.capacityTotal) * 100));
            return (
              <Link key={u.id} href={`/cold-storage/${u.id}`}>
                <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 hover:border-[#334155] transition-all cursor-pointer hover:shadow-lg hover:shadow-blue-500/5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot(u.status)}`} />
                        <h3 className="font-semibold text-slate-100">{u.name}</h3>
                      </div>
                      <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">{u.type?.replace(/_/g,' ')}</span>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Current Temp</p>
                      <p className={`text-4xl font-bold font-mono ${tempColor(u.status)}`}>
                        {latestTemp != null ? `${latestTemp > 0 ? '+' : ''}${latestTemp}°` : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Target</p>
                      <p className="text-lg font-semibold text-slate-400">{u.targetTemp > 0 ? '+' : ''}{u.targetTemp}°C</p>
                    </div>
                  </div>

                  {/* Capacity Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>Capacity Used</span>
                      <span>{capacityUsed} / {u.capacityTotal} {u.capacityUnit}</span>
                    </div>
                    <div className="h-2 bg-[#0a0e1a] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${capacityPct > 90 ? 'bg-red-500' : capacityPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${capacityPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1"><Users className="w-3 h-3" />{u.storageClients?.length || 0} clients</div>
                    <div className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> Sensor: {u.sensorId || 'N/A'}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
