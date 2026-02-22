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
          <h2 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Drivers</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Manage fleet drivers</p>
        </div>
        <button onClick={() => { setForm({}); setEditDriver(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      <div className="bg-white border border-[var(--border-light)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, license..." className="h-10 pl-10 rounded-lg border border-[var(--border-default)] text-sm w-full" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="h-10 w-40 rounded-lg border border-[var(--border-default)] text-sm">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <div className="bg-white border border-[var(--border-light)] rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No drivers found" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Driver</th><th>Phone</th><th>License</th><th>Experience</th><th>Rating</th><th>Status</th><th>Vehicle</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {data.data.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--primary-100)] flex items-center justify-center text-[var(--primary-600)] font-semibold text-sm flex-shrink-0">
                          {d.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)] text-sm">{d.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{d.city || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="mono text-sm text-[var(--text-secondary)]">{d.phone}</td>
                    <td className="mono text-xs text-[var(--text-secondary)]">{d.licenseNumber}</td>
                    <td className="text-[var(--text-secondary)]">{d.experience ?? '—'} yrs</td>
                    <td>
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="text-sm font-medium mono">{(d.rating ?? 0).toFixed(1)}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={d.status} /></td>
                    <td className="text-[var(--text-muted)] text-xs mono">{d.assignments?.[0]?.vehicle?.regNumber || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/drivers/${d.id}`} className="p-2 text-[var(--primary-600)] hover:bg-[var(--primary-50)] rounded-lg transition-colors"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => { setForm({ ...d }); setEditDriver(d); setModalOpen(true); }} className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-table-header)] rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(d.id)} className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
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
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{l}</label>
                <input value={form[n] || ''} onChange={f(n)} className="border border-[var(--border-default)] rounded-lg" />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">License Expiry *</label>
              <input type="date" value={form.licenseExpiry ? form.licenseExpiry.split('T')[0] : ''} onChange={f('licenseExpiry')} className="border border-[var(--border-default)] rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Status</label>
              <select value={form.status || ''} onChange={f('status')} className="border border-[var(--border-default)] rounded-lg">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-[var(--text-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-table-header)]">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="flex-1 py-2.5 text-sm font-semibold text-white bg-[var(--primary-600)] hover:bg-[var(--primary-700)] disabled:opacity-50 rounded-lg">
              {saveMutation.isPending ? 'Saving...' : editDriver ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteMutation.mutate(deleteId!)} loading={deleteMutation.isPending} />
    </div>
  );
}
