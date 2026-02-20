'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, Plus, Thermometer } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-3 text-xs">
      <p className="text-slate-400">{payload[0]?.payload?.time}</p>
      <p className="text-blue-400 font-bold">{payload[0]?.value}°C</p>
    </div>
  );
};

export default function ColdStorageDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [logModal, setLogModal] = useState(false);
  const [logForm, setLogForm] = useState<any>({});

  const { data: unit, isLoading } = useQuery({
    queryKey: ['cold-storage-unit', id],
    queryFn: () => api.get(`/cold-storage/${id}`).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: logs } = useQuery({
    queryKey: ['cold-storage-logs', id],
    queryFn: () => api.get(`/cold-storage/${id}/logs?hours=24`).then(r => r.data),
    refetchInterval: 30000,
  });

  const logMutation = useMutation({
    mutationFn: (payload: any) => api.post(`/cold-storage/${id}/temperature`, payload),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cold-storage-unit', id] });
      qc.invalidateQueries({ queryKey: ['cold-storage-logs', id] });
      qc.invalidateQueries({ queryKey: ['cold-storage'] });
      const deviation = data.data.deviation?.toFixed(1);
      if (data.data.unitStatus !== 'NORMAL') {
        toast.error(`⚠️ Temperature deviation: ${deviation}°C — Status: ${data.data.unitStatus}`);
      } else {
        toast.success('Temperature logged');
      }
      setLogModal(false);
      setLogForm({});
    },
    onError: () => toast.error('Failed to log temperature'),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!unit) return <EmptyState message="Unit not found" />;

  const chartData = logs?.map((l: any) => ({
    time: new Date(l.recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    temp: l.temperature,
    humidity: l.humidity,
  })) || [];

  const latestTemp = unit.temperatureLogs?.[0]?.temperature;
  const tempColor = unit.status === 'CRITICAL' ? 'text-red-400' : unit.status === 'WARNING' ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1a2035] rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-slate-100">{unit.name}</h2>
          <p className="text-sm text-slate-500">{unit.type?.replace(/_/g,' ')} • Sensor: {unit.sensorId}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={unit.status} size="md" />
          <button onClick={() => setLogModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Log Temp
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Current Temp</p>
          <p className={`text-3xl font-bold font-mono ${tempColor}`}>{latestTemp != null ? `${latestTemp}°C` : '—'}</p>
          <p className="text-xs text-slate-500 mt-1">Target: {unit.targetTemp}°C</p>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Humidity</p>
          <p className="text-3xl font-bold text-slate-100">{unit.temperatureLogs?.[0]?.humidity?.toFixed(0) ?? '—'}%</p>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Capacity</p>
          <p className="text-3xl font-bold text-slate-100">{unit.capacityTotal}</p>
          <p className="text-xs text-slate-500">{unit.capacityUnit}</p>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <p className="text-xs text-slate-500 mb-2">Active Clients</p>
          <p className="text-3xl font-bold text-slate-100">{unit.storageClients?.length || 0}</p>
        </div>
      </div>

      {/* Temperature Chart */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
        <h3 className="font-semibold text-slate-100 mb-4 flex items-center gap-2"><Thermometer className="w-4 h-4 text-cyan-400" /> 24-Hour Temperature Log</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={unit.targetTemp} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: 'Target', fill: '#3b82f6', fontSize: 11 }} />
              {unit.maxTemp && <ReferenceLine y={unit.maxTemp} stroke="#f59e0b" strokeDasharray="3 3" />}
              {unit.minTemp && <ReferenceLine y={unit.minTemp} stroke="#f59e0b" strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="temp" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState message="No temperature logs" />}
      </div>

      {/* Clients + Alerts */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e293b]"><h3 className="font-semibold text-slate-100">Storage Clients</h3></div>
          <table>
            <thead><tr><th>Client</th><th>Product</th><th>Space</th><th>Since</th></tr></thead>
            <tbody>
              {unit.storageClients?.map((c: any) => (
                <tr key={c.id}>
                  <td className="font-medium text-slate-200">{c.clientName}</td>
                  <td className="text-xs text-slate-400">{c.productType || '—'}</td>
                  <td className="text-slate-300">{c.spaceUsed} {unit.capacityUnit}</td>
                  <td className="text-xs text-slate-500">{formatDate(c.startDate)}</td>
                </tr>
              ))}
              {!unit.storageClients?.length && <tr><td colSpan={4}><EmptyState message="No clients" /></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e293b]"><h3 className="font-semibold text-slate-100">Recent Alerts</h3></div>
          <div className="divide-y divide-[#1e293b]">
            {unit.alerts?.slice(0, 6).map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200">{a.alertType.replace(/_/g,' ')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{a.message?.substring(0, 60)}...</p>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <p className={`text-xs font-bold ${a.temperature != null ? (Math.abs(a.temperature - unit.targetTemp) >= 5 ? 'text-red-400' : 'text-amber-400') : 'text-slate-400'}`}>
                    {a.temperature != null ? `${a.temperature}°C` : ''}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${a.isResolved ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {a.isResolved ? 'Resolved' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
            {!unit.alerts?.length && <div className="px-5 py-8 text-center text-slate-600 text-sm">No alerts</div>}
          </div>
        </div>
      </div>

      {/* Log Temperature Modal */}
      <Modal isOpen={logModal} onClose={() => setLogModal(false)} title="Log Temperature" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">Target: <span className="text-blue-400 font-bold">{unit.targetTemp}°C</span></p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Temperature (°C) *</label>
            <input type="number" step="0.1" value={logForm.temperature || ''} onChange={e => setLogForm((p: any) => ({ ...p, temperature: parseFloat(e.target.value) }))} placeholder={`${unit.targetTemp}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Humidity (%)</label>
            <input type="number" step="0.1" value={logForm.humidity || ''} onChange={e => setLogForm((p: any) => ({ ...p, humidity: parseFloat(e.target.value) }))} placeholder="65" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setLogModal(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => logMutation.mutate(logForm)} disabled={logMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {logMutation.isPending ? 'Logging...' : 'Log Temperature'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
