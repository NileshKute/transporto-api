'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUSES = ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'];

export default function TripsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [completeTrip, setCompleteTrip] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [completeForm, setCompleteForm] = useState<any>({});

  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/drivers?limit=100').then(r => r.data.data) });

  const { data, isLoading } = useQuery({
    queryKey: ['trips', page, search, status],
    queryFn: () => api.get('/trips', { params: { page, limit: 20, search: search || undefined, status: status || undefined } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/trips', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip created'); setModalOpen(false); setForm({}); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, ...payload }: any) => api.put(`/trips/${id}/complete`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['trips'] }); toast.success('Trip completed!'); setCompleteTrip(null); setCompleteForm({}); },
    onError: () => toast.error('Failed to complete trip'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
        <h2 className="text-2xl font-bold text-slate-900">Trips</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage all trips</p>
        </div>
        <button onClick={() => { setForm({}); setModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> New Trip
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search trip#, location, client..." className="h-10 pl-10 rounded-lg border border-slate-300 text-sm text-slate-900 w-full" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40 rounded-lg border border-slate-300 text-sm text-slate-700">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No trips found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Trip #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Route</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Distance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Bill</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((t: any) => (
                  <tr key={t.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3.5 text-sm font-mono font-bold text-blue-600">{t.tripNumber}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{formatDate(t.date)}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono">{t.vehicle?.regNumber}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-900">{t.driver?.name}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 max-w-[150px]"><span className="truncate block">{t.startLocation} → {t.endLocation || '...'}</span></td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono">{t.distanceKm ? `${t.distanceKm} km` : '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-emerald-600">{t.billAmount ? formatCurrency(t.billAmount) : '—'}</td>
                    <td className="px-4 py-3.5">
                      {t.status === 'IN_PROGRESS' && (
                        <button onClick={() => { setCompleteTrip(t); setCompleteForm({ endKm: t.endKm || '', endLocation: t.endLocation || '' }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                          <CheckCircle className="w-3 h-3" /> Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      {/* Create Trip Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Trip" size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vehicle *</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber} — {v.make} {v.model}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')}>
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.name} — {d.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start KM *</label>
              <input type="number" value={form.startKm || ''} onChange={f('startKm')} placeholder="85000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Location *</label>
              <input value={form.startLocation || ''} onChange={f('startLocation')} placeholder="Delhi (Mundka)" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">End Location</label>
              <input value={form.endLocation || ''} onChange={f('endLocation')} placeholder="Jaipur" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Cargo Type</label>
              <input value={form.cargoType || ''} onChange={f('cargoType')} placeholder="FMCG Goods" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Client Name</label>
              <input value={form.clientName || ''} onChange={f('clientName')} placeholder="Reliance Retail" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Bill Amount (₹)</label>
              <input type="number" value={form.billAmount || ''} onChange={f('billAmount')} placeholder="45000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Toll Amount (₹)</label>
              <input type="number" value={form.tollAmount || ''} onChange={f('tollAmount')} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Complete Trip Modal */}
      <Modal isOpen={!!completeTrip} onClose={() => setCompleteTrip(null)} title="Complete Trip" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400">Trip <span className="text-blue-400 font-mono">{completeTrip?.tripNumber}</span></p>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">End KM *</label>
            <input type="number" value={completeForm.endKm || ''} onChange={e => setCompleteForm((p: any) => ({ ...p, endKm: e.target.value }))} placeholder="Final odometer reading" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">End Location</label>
            <input value={completeForm.endLocation || ''} onChange={e => setCompleteForm((p: any) => ({ ...p, endLocation: e.target.value }))} placeholder="Destination city" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setCompleteTrip(null)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg">Cancel</button>
            <button onClick={() => completeMutation.mutate({ id: completeTrip.id, ...completeForm })} disabled={completeMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg">
              {completeMutation.isPending ? 'Completing...' : 'Mark Completed'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
