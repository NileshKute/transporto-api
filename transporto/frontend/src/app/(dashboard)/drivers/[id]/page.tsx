'use client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatIndianCurrency, formatDate, formatKm } from '@/lib/utils';
import { ArrowLeft, Users, Star, Phone, BookOpen, Wallet, TrendingDown } from 'lucide-react';

export default function DriverDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: d, isLoading } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api.get(`/drivers/${id}`).then(r => r.data),
  });

  const { data: balance } = useQuery({
    queryKey: ['driver-balance', id],
    queryFn: () => api.get(`/driver-ledger/balance/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const now = new Date();
  const { data: summary } = useQuery({
    queryKey: ['driver-summary', id, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => api.get(`/driver-ledger/summary/${id}`, { params: { month: now.getMonth() + 1, year: now.getFullYear() } }).then(r => r.data),
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner />;
  if (!d) return <EmptyState message="Driver not found" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-[#7A9AB8] hover:text-[#0D2847] hover:bg-[#F4F6F8] rounded-lg"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-[#16A34A]/20 flex items-center justify-center text-[#16A34A] font-bold text-xl">
            {d.name?.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0D2847]">{d.name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Phone className="w-3 h-3 text-[#7A9AB8]" />
              <span className="text-sm text-[#7A9AB8] font-mono">{d.phone}</span>
              {d.employeeCode && <span className="text-xs font-mono text-[#42A5F5] ml-2">{d.employeeCode}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[#F59E0B]"><Star className="w-4 h-4 fill-current" /><span className="font-semibold">{Number(d.rating ?? 0).toFixed(1)}</span></div>
          <StatusBadge status={d.status} size="md" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="lg:col-span-2 bg-white border border-[#E0E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#1A4A7A] font-['Barlow_Condensed'] uppercase tracking-wider mb-4">Driver Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {[['License Number', d.licenseNumber || '—'],['License Type', d.licenseType || '—'],['License Expiry', formatDate(d.licenseExpiry)],['Experience', `${String(d.experience ?? 0)} years`],['Blood Group', d.bloodGroup || '—'],['Salary', formatCurrency(d.salary)],['City', d.city || '—'],['State', d.state || '—'],['Emergency Contact', d.emergencyName ? `${d.emergencyName} (${d.emergencyContact})` : '—'],['Total Trips', String(d.totalTrips ?? 0)],['Total KM', formatKm(d.totalKm)],['Joining Date', formatDate(d.joiningDate)]].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-[#7A9AB8] mb-1">{k}</p>
                <p className="text-sm font-medium text-[#0D2847]">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Current Vehicle */}
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[#1A4A7A] font-['Barlow_Condensed'] uppercase tracking-wider mb-4">Assigned Vehicle</h3>
          {d.assignments?.[0] ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-[#42A5F5]" />
              </div>
              <p className="font-mono font-bold text-[#42A5F5] text-lg">{d.assignments[0].vehicle?.regNumber}</p>
              <p className="text-sm text-[#1A4A7A] font-['Barlow_Condensed'] mt-1">{d.assignments[0].vehicle?.make} {d.assignments[0].vehicle?.model}</p>
              <StatusBadge status={d.assignments[0].vehicle?.status} size="md" />
            </div>
          ) : <EmptyState message="No vehicle assigned" />}
        </div>
      </div>

      {/* Ledger Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1565C0]/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-[#1565C0]" /></div>
          <div>
            <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wider text-[#7A9AB8]">Base Salary</p>
            <p className="font-['Oswald'] text-base font-bold text-[#0D2847]">{formatIndianCurrency(d.baseSalary ?? d.salary)}</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#DC2626]/10 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-[#DC2626]" /></div>
          <div>
            <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wider text-[#7A9AB8]">Outstanding Advances</p>
            <p className="font-['Oswald'] text-base font-bold text-[#DC2626]">{formatIndianCurrency(balance?.outstandingBalance ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#16A34A]/10 flex items-center justify-center"><BookOpen className="w-4 h-4 text-[#16A34A]" /></div>
          <div>
            <p className="font-['Barlow_Condensed'] text-[10px] uppercase tracking-wider text-[#7A9AB8]">Net Balance (This Month)</p>
            <p className="font-['Oswald'] text-base font-bold text-[#0D2847]">{formatIndianCurrency(summary?.netBalance ?? 0)}</p>
          </div>
        </div>
        <div className="bg-white border border-[#E0E8F0] rounded-xl p-4 flex items-center justify-center">
          <Link href={`/driver-ledger?driverId=${id}`} className="text-[#1565C0] font-['Barlow_Condensed'] text-sm uppercase tracking-wider hover:underline flex items-center gap-1">
            <BookOpen className="w-4 h-4" /> View Full Ledger
          </Link>
        </div>
      </div>

      {/* Recent Ledger Entries */}
      {summary?.entries?.length > 0 && (
        <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E0E8F0] flex items-center justify-between">
            <h3 className="font-['Barlow_Condensed'] font-semibold uppercase tracking-wider text-[#1A4A7A] text-sm">Recent Ledger Entries</h3>
            <span className="font-['Rajdhani'] text-xs text-[#7A9AB8]">{summary.entries.length} this month</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                  <th className="text-left px-4 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Date</th>
                  <th className="text-left px-4 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Type</th>
                  <th className="text-left px-4 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Description</th>
                  <th className="text-left px-4 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#1A4A7A]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E8F0]">
                {summary.entries.slice(0, 10).map((e: any) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-['Rajdhani'] text-[#0D2847]">{formatDate(e.date)}</td>
                    <td className="px-4 py-2 font-['Barlow_Condensed'] text-xs uppercase text-[#7A9AB8]">{(e.type || '').replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 font-['Rajdhani'] text-[#0D2847]">{e.description || '—'}</td>
                    <td className={`px-4 py-2 font-['Oswald'] font-semibold ${e.isCredit ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                      {e.isCredit ? '+' : '-'}{formatIndianCurrency(Number(e.amount ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trips */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e293b]"><h3 className="font-semibold text-[#0D2847]">Recent Trips</h3></div>
        <div className="overflow-x-auto">
          <table>
            <thead><tr><th>Trip #</th><th>Date</th><th>Route</th><th>Distance</th><th>Status</th><th>Bill</th></tr></thead>
            <tbody>
              {d.trips?.map((t: any) => (
                <tr key={t.id}>
                  <td className="font-mono text-xs text-[#42A5F5]">{t.tripNumber}</td>
                  <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(t.date)}</td>
                  <td className="text-[#1A4A7A] text-xs">{t.startLocation} → {t.endLocation || '...'}</td>
                  <td>{t.distanceKm ? `${t.distanceKm} km` : '—'}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-[#16A34A]">{formatCurrency(t.billAmount)}</td>
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
