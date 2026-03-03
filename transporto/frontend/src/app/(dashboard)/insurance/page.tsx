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
import Link from 'next/link';
import { Plus, AlertTriangle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const I_TYPES = ['COMPREHENSIVE','THIRD_PARTY','ZERO_DEP','OD_ONLY'];
const I_STATUSES = ['ACTIVE','EXPIRING_SOON','EXPIRED','CLAIMED','CANCELLED'];

export default function InsurancePage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({ type: 'COMPREHENSIVE', status: 'ACTIVE' });

  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['insurance', page, status],
    queryFn: () => api.get('/insurance', { params: { page, limit: 20, status: status || undefined } }).then(r => r.data),
  });
  const { data: expiring } = useQuery({ queryKey: ['insurance-expiring'], queryFn: () => api.get('/insurance/expiring').then(r => r.data) });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editItem ? api.put(`/insurance/${editItem.id}`, payload) : api.post('/insurance', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insurance'] }); qc.invalidateQueries({ queryKey: ['insurance-expiring'] }); toast.success(editItem ? 'Policy updated' : 'Policy created'); setModalOpen(false); setForm({ type: 'COMPREHENSIVE', status: 'ACTIVE' }); setEditItem(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  const rowBg = (s: string) => s === 'EXPIRED' ? 'bg-red-50' : s === 'EXPIRING_SOON' ? 'bg-amber-50' : '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-slate-900">Insurance</h2><p className="text-sm text-slate-500">Vehicle insurance policies</p></div>
        <button onClick={() => { setForm({ type: 'COMPREHENSIVE', status: 'ACTIVE' }); setEditItem(null); setModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      {expiring?.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-slate-900"><strong>{expiring.length} insurance {expiring.length === 1 ? 'policy' : 'policies'}</strong> expiring within 30 days.</p>
          <Link href="#table" className="text-sm font-semibold text-blue-600 hover:underline">View →</Link>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5 flex gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-48 rounded-lg border border-slate-300 text-sm text-slate-700">
          <option value="">All Statuses</option>
          {I_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div id="table" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No insurance policies" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Policy #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Premium</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Cover</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Expiry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Agent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((i: any) => (
                  <tr key={i.id} className={`${rowBg(i.status)} hover:bg-blue-50/50 transition-colors`}>
                    <td className="px-4 py-3.5 text-sm font-mono font-semibold text-slate-900">{i.vehicle?.regNumber}</td>
                    <td className="px-4 py-3.5 font-medium text-slate-900">{i.provider}</td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 font-mono">{i.policyNumber}</td>
                    <td className="px-4 py-3.5"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{i.type?.replace(/_/g,' ')}</span></td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-emerald-600">{formatCurrency(i.premium)}</td>
                    <td className="px-4 py-3.5 font-mono text-slate-700">{i.coverAmount ? formatCurrency(i.coverAmount) : '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{formatDate(i.startDate)}</td>
                    <td className={`px-4 py-3.5 text-xs font-medium ${i.status === 'EXPIRED' ? 'text-red-500' : i.status === 'EXPIRING_SOON' ? 'text-amber-500' : 'text-slate-500'}`}>{formatDate(i.endDate)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={i.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{i.agentName || '—'}</td>
                    <td className="px-4 py-3.5">
                      <button onClick={() => { setForm({ ...i, startDate: i.startDate?.split('T')[0], endDate: i.endDate?.split('T')[0] }); setEditItem(i); setModalOpen(true); }}
                        className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 bg-blue-100 rounded-lg">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} title={editItem ? 'Edit Policy' : 'Add Insurance Policy'} size="lg">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vehicle *</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber} — {v.make}</option>)}
              </select>
            </div>
            {[['provider','Provider *'],['policyNumber','Policy Number *'],['premium','Premium (₹) *'],['coverAmount','Cover Amount (₹)'],['agentName','Agent Name'],['agentPhone','Agent Phone']].map(([n, l]) => (
              <div key={n}>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">{l}</label>
                <input type={n.includes('premium') || n.includes('Amount') ? 'number' : 'text'} value={form[n] || ''} onChange={f(n)} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Type *</label>
              <select value={form.type || 'COMPREHENSIVE'} onChange={f('type')}>
                {I_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Status</label>
              <select value={form.status || 'ACTIVE'} onChange={f('status')}>
                {I_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate || ''} onChange={f('startDate')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">End Date *</label>
              <input type="date" value={form.endDate || ''} onChange={f('endDate')} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {saveMutation.isPending ? 'Saving...' : editItem ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
