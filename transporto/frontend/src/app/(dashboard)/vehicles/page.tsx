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
import { formatKm } from '@/lib/utils';
import { Plus, Eye, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

const VEHICLE_TYPES = ['TRUCK','MINI_TRUCK','TRAILER','REEFER_TRUCK','TANKER','PICKUP','VAN','TEMPO','CONTAINER'];
const FUEL_TYPES = ['DIESEL','PETROL','CNG','ELECTRIC','HYBRID'];
const STATUSES = ['ACTIVE','IN_MAINTENANCE','IDLE','BREAKDOWN','SOLD','DECOMMISSIONED'];

function VehicleFormFields({ form, setForm }: { form: any, setForm: any }) {
  const field = (name: string, label: string, type = 'text', opts?: any) => (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {opts?.options ? (
        <select value={form[name] || ''} onChange={e => setForm((p: any) => ({ ...p, [name]: e.target.value }))}>
          <option value="">Select {label}</option>
          {opts.options.map((o: string) => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
        </select>
      ) : (
        <input type={type} value={form[name] || ''} onChange={e => setForm((p: any) => ({ ...p, [name]: type === 'number' ? Number(e.target.value) : e.target.value }))} placeholder={opts?.placeholder} />
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      {field('regNumber', 'Reg Number *', 'text', { placeholder: 'DL01AB1234' })}
      {field('type', 'Vehicle Type *', 'text', { options: VEHICLE_TYPES })}
      {field('make', 'Make *', 'text', { placeholder: 'Tata' })}
      {field('model', 'Model *', 'text', { placeholder: 'Prima 4928' })}
      {field('year', 'Year *', 'number', { placeholder: '2022' })}
      {field('fuelType', 'Fuel Type', 'text', { options: FUEL_TYPES })}
      {field('loadCapacityKg', 'Load Capacity (kg)', 'number')}
      {field('numTires', 'Number of Tires', 'number')}
      {field('tankCapacityL', 'Tank Capacity (L)', 'number')}
      {field('color', 'Color')}
      {field('chassisNumber', 'Chassis Number')}
      {field('engineNumber', 'Engine Number')}
    </div>
  );
}

export default function VehiclesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ['vehicles', page, search, status, type],
    queryFn: () => api.get('/vehicles', { params: { page, limit: 20, search: search || undefined, status: status || undefined, type: type || undefined } }).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editVehicle ? api.put(`/vehicles/${editVehicle.id}`, payload) : api.post('/vehicles', payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.success(editVehicle ? 'Vehicle updated' : 'Vehicle created'); setModalOpen(false); setForm({}); setEditVehicle(null); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vehicles'] }); toast.success('Vehicle deleted'); setDeleteId(null); },
    onError: () => toast.error('Failed to delete'),
  });

  const openCreate = () => { setForm({ fuelType: 'DIESEL' }); setEditVehicle(null); setModalOpen(true); };
  const openEdit = (v: any) => { setForm({ ...v }); setEditVehicle(v); setModalOpen(true); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Vehicles</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your fleet vehicles</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search reg, make, model..." style={{ paddingLeft: '36px' }} />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="w-40">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="w-40">
          <option value="">All Types</option>
          {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        {isLoading ? <LoadingSpinner /> : !data?.data?.length ? <EmptyState message="No vehicles found" /> : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr><th>Reg Number</th><th>Type</th><th>Make & Model</th><th>Year</th><th>Status</th><th>Current KM</th><th>Driver</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {data.data.map((v: any) => (
                  <tr key={v.id}>
                    <td><span className="font-mono font-bold text-blue-400">{v.regNumber}</span></td>
                    <td><span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">{v.type?.replace(/_/g,' ')}</span></td>
                    <td className="text-slate-200">{v.make} {v.model}</td>
                    <td className="text-slate-400">{v.year}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td className="text-slate-300">{formatKm(v.currentKm)}</td>
                    <td className="text-slate-400 text-xs">{v.assignments?.[0]?.driver?.name || '—'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link href={`/vehicles/${v.id}`} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Eye className="w-4 h-4" /></Link>
                        <button onClick={() => openEdit(v)} className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteId(v.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
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

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditVehicle(null); }} title={editVehicle ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <div className="p-5 space-y-4">
          <VehicleFormFields form={form} setForm={setForm} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-300 bg-[#1a2035] hover:bg-[#243050] rounded-lg transition-colors">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors">
              {saveMutation.isPending ? 'Saving...' : editVehicle ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteMutation.mutate(deleteId!)} loading={deleteMutation.isPending} message="This vehicle will be soft-deleted. You can restore it later." />
    </div>
  );
}
