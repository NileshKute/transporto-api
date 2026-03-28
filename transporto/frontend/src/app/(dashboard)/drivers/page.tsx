'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, Pencil, Trash2, Search, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const STATUSES = ['AVAILABLE','ON_TRIP','ON_LEAVE','OFF_DUTY','TERMINATED'];

export default function DriversPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editDriver, setEditDriver] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, status],
    queryFn: () => api.get('/drivers', { params: { page, limit: 20, search: search || undefined, status: status || undefined } }).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editDriver ? api.put(`/drivers/${editDriver.id}`, payload) : api.post('/drivers', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success(editDriver ? 'Driver updated' : 'Driver created'); setModalOpen(false); setForm({}); setEditDriver(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/drivers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drivers'] }); toast.success('Driver deleted'); setDeleteId(null); },
    onError: () => toast.error('Failed to delete'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
        <h2 className="font-['Oswald'] text-xl font-bold text-[#0D2847] tracking-wide uppercase">Drivers</h2>
        <p className="font-['Rajdhani'] text-sm text-[#7A9AB8] mt-0.5">Manage fleet drivers</p>
        </div>
        <button onClick={() => { setForm({}); setEditDriver(null); setModalOpen(true); }}
          className="flex items-center gap-2 bg-[#1565C0] hover:bg-[#0D2847] text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A9AB8]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, license..." className="h-10 pl-10 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847] w-full" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40 rounded-lg border border-[#E0E8F0] text-sm text-[#0D2847]">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No drivers found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Driver</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">License</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Experience</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Rating</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {data.data.map((d: any) => (
                  <tr key={d.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                          {d.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[#0D2847] text-sm">{d.name}</p>
                          <p className="text-xs text-[#1A4A7A]">{d.city || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-[#0D2847] font-mono">{d.phone}</td>
                    <td className="px-4 py-3.5 text-xs text-[#0D2847] font-mono">{d.licenseNumber}</td>
                    <td className="px-4 py-3.5 text-[#0D2847]">{String(d.experience ?? 0)} yrs</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-sm font-medium font-mono">{(d.rating ?? 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-3.5 text-[#1A4A7A] text-xs font-mono">{d.assignments?.[0]?.vehicle?.regNumber || '—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <Link href={`/drivers/${d.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => { setForm({ ...d }); setEditDriver(d); setModalOpen(true); }} className="p-2 text-[#1A4A7A] hover:bg-slate-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(d.id)} className="p-2 text-[#1A4A7A] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
      </div>

      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditDriver(null); }} title={editDriver ? 'Edit Driver' : 'Add Driver'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[['name','Name *'],['phone','Phone *'],['licenseNumber','License Number *'],['licenseType','License Type'],['experience','Experience (years)'],['salary','Salary (₹)'],['bloodGroup','Blood Group'],['city','City'],['state','State'],['emergencyContact','Emergency Contact'],['emergencyName','Emergency Contact Name']].map(([n, l]) => (
              <div key={n}>
                <label className="block text-xs font-medium text-[#475569] mb-1.5">{l}</label>
                <input value={form[n] || ''} onChange={f(n)} className="border border-[#cbd5e1] rounded-lg" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">License Expiry *</label>
              <input type="date" value={form.licenseExpiry ? String(form.licenseExpiry).split('T')[0] : ''} onChange={f('licenseExpiry')} className="border border-[#cbd5e1] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1.5">Status</label>
              <select value={form.status || ''} onChange={f('status')} className="border border-[#cbd5e1] rounded-lg">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-[#475569] border border-[#cbd5e1] rounded-lg hover:bg-[#f1f5f9]">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 rounded-lg">
              {saveMutation.isPending ? 'Saving...' : editDriver ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteMutation.mutate(deleteId!)} loading={deleteMutation.isPending} />
    </div>
  );
}
