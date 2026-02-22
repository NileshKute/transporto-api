'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Plus, Play, Square } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/drivers?limit=100').then(r => r.data.data) });
  const { data: vehicles } = useQuery({ queryKey: ['vehicles-list'], queryFn: () => api.get('/vehicles?limit=100').then(r => r.data.data) });
  const { data, isLoading } = useQuery({
    queryKey: ['shifts', page, filterStatus],
    queryFn: () => api.get('/shifts', { params: { page, limit: 20, status: filterStatus || undefined } }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.post('/shifts', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift created'); setModalOpen(false); setForm({}); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.put(`/shifts/${id}/start`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift started'); },
    onError: () => toast.error('Failed'),
  });

  const endMutation = useMutation({
    mutationFn: (id: string) => api.put(`/shifts/${id}/end`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shifts'] }); toast.success('Shift ended — hours calculated'); },
    onError: () => toast.error('Failed'),
  });

  const f = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p: any) => ({ ...p, [name]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Shifts</h2><p className="text-sm text-[var(--text-secondary)]">Driver shift management</p></div>
        <button onClick={() => { setForm({}); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary-600)] hover:bg-[var(--primary-700)] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
          <Plus className="w-4 h-4" /> Create Shift
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map(s => (
          <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${filterStatus === s ? 'bg-[var(--primary-600)] text-white' : 'bg-white border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-table-header)]'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[var(--border-light)] rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No shifts found" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Driver</th><th>Vehicle</th><th>Date</th><th>Start</th><th>End</th><th>Hours</th><th>Overtime</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {data.data.map((s: any) => (
                  <tr key={s.id} className={s.overtime > 0 ? 'border-l-4 border-l-amber-500 bg-amber-50/50' : ''}>
                    <td className="font-medium text-[var(--text-primary)]">{s.driver?.name}</td>
                    <td className="mono text-sm text-[var(--text-secondary)]">{s.vehicle?.regNumber || '—'}</td>
                    <td className="text-sm text-[var(--text-muted)]">{formatDate(s.date)}</td>
                    <td className="text-xs text-[var(--text-secondary)]">{formatDateTime(s.startTime)}</td>
                    <td className="text-xs text-[var(--text-muted)]">{s.endTime ? formatDateTime(s.endTime) : '—'}</td>
                    <td className="mono font-medium text-[var(--text-primary)]">{s.hoursWorked != null ? `${Math.floor(s.hoursWorked)}h ${Math.round((s.hoursWorked % 1) * 60)}m` : '—'}</td>
                    <td>{s.overtime > 0 ? <span className="text-amber-400 font-bold text-sm">+{s.overtime}h OT</span> : <span className="text-slate-600">—</span>}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        {s.status === 'SCHEDULED' && (
                          <button onClick={() => startMutation.mutate(s.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">
                            <Play className="w-3 h-3 fill-current" /> Start
                          </button>
                        )}
                        {s.status === 'ACTIVE' && (
                          <button onClick={() => endMutation.mutate(s.id)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                            <Square className="w-3 h-3 fill-current" /> End
                          </button>
                        )}
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Shift" size="md">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Driver *</label>
              <select value={form.driverId || ''} onChange={f('driverId')}>
                <option value="">Select Driver</option>
                {drivers?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Vehicle</label>
              <select value={form.vehicleId || ''} onChange={f('vehicleId')}>
                <option value="">Select Vehicle</option>
                {vehicles?.map((v: any) => <option key={v.id} value={v.id}>{v.regNumber}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Date *</label>
              <input type="date" value={form.date || ''} onChange={f('date')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Time *</label>
              <input type="datetime-local" value={form.startTime || ''} onChange={f('startTime')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes</label>
              <input value={form.notes || ''} onChange={f('notes')} placeholder="Optional notes" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-slate-300 bg-[#1a2035] rounded-lg">Cancel</button>
            <button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg">
              {createMutation.isPending ? 'Creating...' : 'Create Shift'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
