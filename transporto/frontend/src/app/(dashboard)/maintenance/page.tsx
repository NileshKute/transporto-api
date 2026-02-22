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
import { Plus, Wrench, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const M_TYPES = ['SCHEDULED_SERVICE','ENGINE_REPAIR','TIRE_REPLACEMENT','BRAKE_SERVICE','OIL_CHANGE','ELECTRICAL','BODY_WORK','AC_REPAIR','CLUTCH','GEAR_BOX','SUSPENSION','BATTERY','RADIATOR','OTHER'];
const M_STATUSES = ['SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'];
const PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'];

export default function MaintenancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | 'due'>('all');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ status: 'SCHEDULED', priority: 'MEDIUM' });

  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['maintenance', tab, page],
    queryFn: () => tab === 'due' ? api.get('/maintenance/due').then(r => ({ data: r.data, total: r.data.length, totalPages: 1 })) : api.get('/maintenance', { params: { page, limit: 20 } }).then(r => r.data),
  });
  const { data: dueData } = useQuery({ queryKey: ['maintenance-due'], queryFn: () => api.get('/maintenance/due').then(r => r.data) });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editItem ? api.put(`/maintenance/${editItem.id}`, payload) : api.post('/maintenance', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); toast.success(editItem ? 'Record updated' : 'Record created'); setModalOpen(false); setForm({ status: 'SCHEDULED', priority: 'MEDIUM' }); setEditItem(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  const priorityColor: Record<string, string> = { LOW: 'text-slate-500', MEDIUM: 'text-blue-600', HIGH: 'text-amber-600', CRITICAL: 'text-red-600' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Maintenance</h2><p className="text-sm text-[#475569]">Vehicle maintenance records</p></div>
        <button onClick={() => { setForm({ status: 'SCHEDULED', priority: 'MEDIUM' }); setEditItem(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-[#e2e8f0] rounded-xl p-1 w-fit shadow-sm">
        {(['all', 'due'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === t ? 'bg-[#2563eb] text-white' : 'text-[#475569] hover:text-[#0f172a] hover:bg-[#f1f5f9]'}`}>
            {t === 'all' ? <><Wrench className="w-3.5 h-3.5" /> All Records</> : <><AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Due Soon {dueData?.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{dueData.length}</span>}</>}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message={tab === 'due' ? 'No maintenance due soon' : 'No maintenance records'} /> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Vehicle</th><th>Type</th><th>Description</th><th>Cost</th><th>Status</th><th>Priority</th><th>Date</th><th>Next Due</th><th>Garage</th><th>Actions</th></tr></thead>
              <tbody>
                {data.data.map((m: any) => (
                  <tr key={m.id}>
                    <td className="mono text-sm text-[#2563eb]">{m.vehicle?.regNumber}</td>
                    <td><span className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-1 rounded font-medium">{m.type?.replace(/_/g,' ')}</span></td>
                    <td className="text-[#475569] text-xs max-w-[160px] truncate">{m.description || '—'}</td>
                    <td className="mono font-semibold text-[#0f172a]">{formatCurrency(m.cost)}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td><span className={`text-xs font-semibold ${priorityColor[m.priority]}`}>● {m.priority}</span></td>
                    <td className="text-xs text-[#94a3b8]">{formatDate(m.date)}</td>
                    <td className="text-xs text-amber-600">{m.nextDueDate ? formatDate(m.nextDueDate) : '—'}</td>
                    <td className="text-xs text-[#94a3b8]">{m.garage || '—'}</td>
                    <td>
                      <button onClick={() => { setForm({ ...m, date: m.date?.split('T')[0], nextDueDate: m.nextDueDate?.split('T')[0] }); setEditItem(m); setModalOpen(true); }}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/10 rounded-lg">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && tab === 'all' && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} title={editItem ? 'Edit Maintenance' : 'Add Maintenance'} size="lg">
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
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Type *</label>
              <select value={form.type || ''} onChange={f('type')}>
                <option value="">Select Type</option>
                {M_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            {[['description','Description'],['cost','Cost (₹)'],['laborCost','Labor Cost (₹)'],['partsCost','Parts Cost (₹)'],['garage','Garage Name'],['garagePhone','Garage Phone'],['mechanicName','Mechanic Name']].map(([n, l]) => (
              <div key={n}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{l}</label>
                <input type={n.includes('cost') || n.includes('Cost') ? 'number' : 'text'} value={form[n] || ''} onChange={f(n)} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Next Due Date</label>
              <input type="date" value={form.nextDueDate || ''} onChange={f('nextDueDate')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
              <select value={form.status || 'SCHEDULED'} onChange={f('status')}>
                {M_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Priority</label>
              <select value={form.priority || 'MEDIUM'} onChange={f('priority')}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {saveMutation.isPending ? 'Saving...' : editItem ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
