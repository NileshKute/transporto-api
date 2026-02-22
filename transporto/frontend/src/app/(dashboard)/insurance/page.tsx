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
        <div><h2 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Insurance</h2><p className="text-sm text-[#475569]">Vehicle insurance policies</p></div>
        <button onClick={() => { setForm({ type: 'COMPREHENSIVE', status: 'ACTIVE' }); setEditItem(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Policy
        </button>
      </div>

      {expiring?.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-[#0f172a]"><strong>{expiring.length} insurance {expiring.length === 1 ? 'policy' : 'policies'}</strong> expiring within 30 days.</p>
          <Link href="#table" className="text-sm font-semibold text-[#2563eb] hover:underline">View →</Link>
        </div>
      )}

      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm flex gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-48 rounded-lg border border-[#cbd5e1] text-sm">
          <option value="">All Statuses</option>
          {I_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div id="table" className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden shadow-sm">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No insurance policies" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Vehicle</th><th>Provider</th><th>Policy #</th><th>Type</th><th>Premium</th><th>Cover</th><th>Start</th><th>Expiry</th><th>Status</th><th>Agent</th><th>Actions</th></tr></thead>
              <tbody>
                {data.data.map((i: any) => (
                  <tr key={i.id} className={rowBg(i.status)}>
                    <td className="mono text-sm font-semibold text-[#0f172a]">{i.vehicle?.regNumber}</td>
                    <td className="font-medium text-[#0f172a]">{i.provider}</td>
                    <td className="mono text-sm text-[#475569]">{i.policyNumber}</td>
                    <td><span className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded font-medium">{i.type?.replace(/_/g,' ')}</span></td>
                    <td className="mono font-semibold text-emerald-600">{formatCurrency(i.premium)}</td>
                    <td className="mono text-[#475569]">{i.coverAmount ? formatCurrency(i.coverAmount) : '—'}</td>
                    <td className="text-xs text-[#94a3b8]">{formatDate(i.startDate)}</td>
                    <td className={`text-xs font-medium ${i.status === 'EXPIRED' ? 'text-red-400' : i.status === 'EXPIRING_SOON' ? 'text-amber-400' : 'text-slate-400'}`}>{formatDate(i.endDate)}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td className="text-xs text-slate-400">{i.agentName || '—'}</td>
                    <td>
                      <button onClick={() => { setForm({ ...i, startDate: i.startDate?.split('T')[0], endDate: i.endDate?.split('T')[0] }); setEditItem(i); setModalOpen(true); }}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-500/10 rounded-lg">Edit</button>
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
