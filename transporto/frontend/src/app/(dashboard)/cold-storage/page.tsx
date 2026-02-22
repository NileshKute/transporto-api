'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Thermometer, AlertTriangle, Users, Zap } from 'lucide-react';
import Link from 'next/link';

const tempColor = (status: string) => {
  if (status === 'CRITICAL') return 'text-red-600';
  if (status === 'WARNING') return 'text-amber-600';
  return 'text-emerald-600';
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
        <h2 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Cold Storage</h2>
        <p className="text-sm text-[#475569]">Monitor temperature and storage units</p>
      </div>

      {alerts?.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-700">{alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}</h3>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm text-[#0f172a]">
                <span>{a.unit?.name} — {a.alertType.replace(/_/g,' ')}</span>
                <span className="text-xs mono">{a.temperature != null ? `${a.temperature}°C` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : !units?.length ? <EmptyState message="No cold storage units" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {units.map((u: any) => {
            const latestTemp = u.temperatureLogs?.[0]?.temperature;
            const capacityUsed = u.storageClients?.reduce((acc: number, c: any) => acc + (c.spaceUsed || 0), 0) || 0;
            const capacityPct = Math.min(100, u.capacityTotal ? Math.round((capacityUsed / u.capacityTotal) * 100) : 0);
            return (
              <Link key={u.id} href={`/cold-storage/${u.id}`}>
                <div className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:bg-[#f8fafc] transition-all cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot(u.status)} ${u.status === 'WARNING' || u.status === 'CRITICAL' ? 'animate-pulse' : ''}`} />
                        <h3 className="font-semibold text-[#0f172a]">{u.name}</h3>
                      </div>
                      <span className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded font-medium">{u.type?.replace(/_/g,' ')}</span>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-xs text-[#94a3b8] mb-1">Current Temp</p>
                      <p className={`text-4xl font-bold mono ${tempColor(u.status)}`}>
                        {latestTemp != null ? `${latestTemp > 0 ? '+' : ''}${latestTemp}°` : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#94a3b8]">Target</p>
                      <p className="text-sm font-semibold text-[#475569]">{u.targetTemp != null && u.targetTemp > 0 ? '+' : ''}{u.targetTemp}°C</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-[#94a3b8] mb-1.5">
                      <span>Capacity</span>
                      <span className="mono">{capacityUsed} / {u.capacityTotal} {u.capacityUnit || 'Tons'}</span>
                    </div>
                    <div className="h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${capacityPct > 90 ? 'bg-red-500' : capacityPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${capacityPct}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                    <div className="flex items-center gap-1"><Users className="w-3 h-3" />{u.storageClients?.length || 0} active clients</div>
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
