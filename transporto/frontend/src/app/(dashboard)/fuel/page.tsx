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
        <div>
        <h2 className="text-2xl font-bold text-slate-900">Fuel</h2>
        <p className="text-sm text-slate-500 mt-0.5">Track fuel consumption and costs</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Fuel Entry
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Fuel} iconColor="amber" title="Total Entries" value={stats?.totalEntries ?? 0} />
        <StatCard icon={Droplets} iconColor="blue" title="Total Liters" value={`${stats?.totalLiters?.toFixed(0) ?? 0} L`} />
        <StatCard icon={DollarSign} iconColor="amber" title="Total Cost" value={formatCurrency(stats?.totalCost)} />
        <StatCard icon={Gauge} iconColor="green" title="Avg Rate (₹/L)" value={stats?.avgRatePerLiter != null ? `₹${stats.avgRatePerLiter.toFixed(2)}` : '—'} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No fuel entries" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Liters</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Station</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((f: any) => (
                  <tr key={f.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono font-semibold">{f.vehicle?.regNumber}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono">{f.liters} L</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono font-semibold text-emerald-600">{formatCurrency(f.totalCost)}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{f.fuelStation || '—'}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-500">{formatDate(f.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Fuel Entry" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Vehicle *</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')} className="border border-[#cbd5e1] rounded-lg">
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber} — {v.make}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')} className="border border-[#cbd5e1] rounded-lg">
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Fuel Type</label>
              <select value={form.fuelType || 'DIESEL'} onChange={f('fuelType')} className="border border-[#cbd5e1] rounded-lg">
                {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Liters *</label>
              <input type="number" step="0.1" value={form.liters || ''} onChange={f('liters')} placeholder="80" className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Total Cost (₹) *</label>
              <input type="number" step="0.01" value={form.totalCost || ''} onChange={f('totalCost')} placeholder="7240" className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Odometer (km) *</label>
              <input type="number" value={form.odometer || ''} onChange={f('odometer')} placeholder="85000" className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Fuel Station</label>
              <input value={form.fuelStation || ''} onChange={f('fuelStation')} placeholder="HP Petrol Pump, NH48" className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Payment Mode</label>
              <select value={form.paymentMode || 'CASH'} onChange={f('paymentMode')} className="border border-[#cbd5e1] rounded-lg">
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-[#f1f5f9]">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Saving...' : 'Add Entry'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
