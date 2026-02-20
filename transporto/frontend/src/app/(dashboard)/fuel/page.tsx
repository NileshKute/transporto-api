'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Fuel, Plus, TrendingUp, Droplets, DollarSign, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';

const PAYMENT_MODES = ['CASH','UPI','CARD','CREDIT','COMPANY_ACCOUNT'];
const FUEL_TYPES = ['DIESEL','PETROL','CNG','ELECTRIC','HYBRID'];

export default function FuelPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({ fuelType: 'DIESEL', paymentMode: 'CASH', isFull: true });

  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/drivers?limit=100').then(r => r.data.data) });
  const { data: stats } = useQuery({ queryKey: ['fuel-stats'], queryFn: () => api.get('/fuel/stats').then(r => r.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['fuel', page],
    queryFn: () => api.get('/fuel', { params: { page, limit: 20 } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/fuel', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fuel'] }); qc.invalidateQueries({ queryKey: ['fuel-stats'] }); toast.success('Fuel entry added'); setModalOpen(false); setForm({ fuelType: 'DIESEL', paymentMode: 'CASH', isFull: true }); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-xl font-bold text-slate-100">Fuel Management</h2><p className="text-sm text-slate-500">Track fuel consumption and costs</p></div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Fuel Entry
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Entries" value={stats?.totalEntries ?? 0} icon={Fuel} color="amber" />
        <StatCard title="Total Liters" value={`${stats?.totalLiters?.toFixed(0) ?? 0}L`} icon={Droplets} color="blue" />
        <StatCard title="Total Spend" value={formatCurrency(stats?.totalCost)} icon={DollarSign} color="green" />
        <StatCard title="Avg Rate/Liter" value={`₹${stats?.avgRatePerLiter?.toFixed(2) ?? 0}`} icon={Gauge} color="purple" />
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No fuel entries" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Entry #</th><th>Date</th><th>Vehicle</th><th>Driver</th><th>Liters</th><th>Rate/L</th><th>Total Cost</th><th>Station</th><th>Payment</th></tr></thead>
              <tbody>
                {data.data.map((f: any) => (
                  <tr key={f.id}>
                    <td className="font-mono text-xs text-amber-400">{f.entryNumber}</td>
                    <td className="text-xs text-slate-400">{formatDate(f.date)}</td>
                    <td className="font-mono text-xs text-blue-400">{f.vehicle?.regNumber}</td>
                    <td className="text-sm text-slate-300">{f.driver?.name}</td>
                    <td className="text-slate-300 font-medium">{f.liters}L</td>
                    <td className="text-slate-400">₹{f.ratePerLiter?.toFixed(2)}</td>
                    <td className="text-emerald-400 font-bold">{formatCurrency(f.totalCost)}</td>
                    <td className="text-slate-400 text-xs">{f.fuelStation || '—'}</td>
                    <td><span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">{f.paymentMode?.replace(/_/g,' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Fuel Entry" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vehicle *</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber} — {v.make}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')}>
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Fuel Type</label>
              <select value={form.fuelType || 'DIESEL'} onChange={f('fuelType')}>
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Liters *</label>
              <input type="number" step="0.1" value={form.liters || ''} onChange={f('liters')} placeholder="80" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Total Cost (₹) *</label>
              <input type="number" step="0.01" value={form.totalCost || ''} onChange={f('totalCost')} placeholder="7240" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Odometer (km) *</label>
              <input type="number" value={form.odometer || ''} onChange={f('odometer')} placeholder="85000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Fuel Station</label>
              <input value={form.fuelStation || ''} onChange={f('fuelStation')} placeholder="HP Petrol Pump, NH48" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Mode</label>
              <select value={form.paymentMode || 'CASH'} onChange={f('paymentMode')}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Saving...' : 'Add Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
