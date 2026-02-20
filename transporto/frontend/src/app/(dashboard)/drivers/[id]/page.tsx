'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatKm } from '@/lib/utils';
import { ArrowLeft, Users, Star, Phone } from 'lucide-react';

export default function DriverDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: d, isLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api.get(`/drivers/${id}`).then(r => r.data),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!d) return <EmptyState message="Driver not found" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1a2035] rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl">
            {d.name?.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{d.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Phone className="w-3 h-3 text-slate-500" />
              <span className="text-sm text-slate-500 font-mono">{d.phone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-amber-400"><Star className="w-4 h-4 fill-current" /><span className="font-semibold">{d.rating?.toFixed(1)}</span></div>
          <StatusBadge status={d.status} size="md" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Driver Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {[['License Number', d.licenseNumber],['License Type', d.licenseType || '—'],['License Expiry', formatDate(d.licenseExpiry)],['Experience', `${d.experience} years`],['Blood Group', d.bloodGroup || '—'],['Salary', formatCurrency(d.salary)],['City', d.city || '—'],['State', d.state || '—'],['Emergency Contact', d.emergencyName ? `${d.emergencyName} (${d.emergencyContact})` : '—'],['Total Trips', d.totalTrips],['Total KM', formatKm(d.totalKm)],['Joining Date', formatDate(d.joiningDate)]].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-slate-500 mb-1">{k}</p>
                <p className="text-sm font-medium text-slate-200">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Current Vehicle */}
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Assigned Vehicle</h3>
          {d.assignments?.[0] ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-blue-400" />
              </div>
              <p className="font-mono font-bold text-blue-400 text-lg">{d.assignments[0].vehicle?.regNumber}</p>
              <p className="text-sm text-slate-400 mt-1">{d.assignments[0].vehicle?.make} {d.assignments[0].vehicle?.model}</p>
              <StatusBadge status={d.assignments[0].vehicle?.status} size="md" />
            </div>
          ) : <EmptyState message="No vehicle assigned" />}
        </div>
      </div>

      {/* Trips */}
      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e293b]"><h3 className="font-semibold text-slate-100">Recent Trips</h3></div>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th>Trip #</th><th>Date</th><th>Route</th><th>Distance</th><th>Status</th><th>Bill</th></tr></thead>
            <tbody>
              {d.trips?.map((t: any) => (
                <tr key={t.id}>
                  <td className="font-mono text-xs text-blue-400">{t.tripNumber}</td>
                  <td className="text-xs text-slate-400">{formatDate(t.date)}</td>
                  <td className="text-slate-300 text-xs">{t.startLocation} → {t.endLocation || '...'}</td>
                  <td>{t.distanceKm ? `${t.distanceKm} km` : '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-emerald-400">{formatCurrency(t.billAmount)}</td>
                </tr>
              ))}
              {!d.trips?.length && <tr><td colSpan={6}><EmptyState message="No trips" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
