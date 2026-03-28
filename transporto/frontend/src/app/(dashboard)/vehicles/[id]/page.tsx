'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatKm } from '@/lib/utils';
import { ArrowLeft, Truck } from 'lucide-react';

const TABS = ['Trips', 'Fuel', 'Maintenance', 'Insurance', 'Documents'];

export default function VehicleDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tab, setTab] = useState('Trips');

  const { data: v, isLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api.get(`/vehicles/${id}`).then(r => r.data),
  });

  if (isLoading) return <LoadingSpinner />;
  if (!v) return <EmptyState message="Vehicle not found" />;

  const info = [
    ['Make', v.make || '—'], ['Model', v.model || '—'], ['Year', String(v.year ?? '—')], ['Fuel Type', v.fuelType || '—'],
    ['Current KM', formatKm(v.currentKm)], ['Load Capacity', v.loadCapacityKg ? `${v.loadCapacityKg} kg` : '—'],
    ['Tires', String(v.numTires || '—')], ['Tank', v.tankCapacityL ? `${v.tankCapacityL} L` : '—'],
    ['Chassis', v.chassisNumber || '—'], ['Engine', v.engineNumber || '—'],
    ['Color', v.color || '—'], ['Purchase Date', formatDate(v.purchaseDate)],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-[#7A9AB8] hover:text-[#0D2847] hover:bg-[#F4F6F8] rounded-lg transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-[#42A5F5]/10 rounded-xl"><Truck className="w-5 h-5 text-[#42A5F5]" /></div>
          <div>
            <h2 className="text-xl font-bold text-[#0D2847] font-mono">{v.regNumber}</h2>
            <p className="text-sm text-[#7A9AB8]">{v.make} {v.model} • {v.year}</p>
          </div>
        </div>
        <StatusBadge status={v.status} size="md" />
      </div>

      {/* Info Grid */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#1A4A7A] font-['Barlow_Condensed'] uppercase tracking-wider mb-4">Vehicle Information</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {info.map(([k, val]) => (
            <div key={k}>
              <p className="text-xs text-[#7A9AB8] mb-1">{k}</p>
              <p className="text-sm font-medium text-[#0D2847]">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-[#E0E8F0] rounded-xl overflow-hidden">
        <div className="flex border-b border-[#E0E8F0] overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'text-[#42A5F5] border-b-2 border-[#42A5F5]' : 'text-[#1A4A7A] hover:text-[#0D2847]'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          {tab === 'Trips' && (
            <table>
              <thead><tr><th>Trip #</th><th>Date</th><th>Route</th><th>Distance</th><th>Status</th></tr></thead>
              <tbody>
                {v.trips?.map((t: any) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs text-[#42A5F5]">{t.tripNumber}</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed'] text-xs">{formatDate(t.date)}</td>
                    <td className="text-[#1A4A7A] text-xs">{t.startLocation} → {t.endLocation || '...'}</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed']">{t.distanceKm ? `${t.distanceKm} km` : '—'}</td>
                    <td><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
                {!v.trips?.length && <tr><td colSpan={5}><EmptyState message="No trips" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Fuel' && (
            <table>
              <thead><tr><th>Entry #</th><th>Date</th><th>Liters</th><th>Rate/L</th><th>Total</th><th>Station</th></tr></thead>
              <tbody>
                {v.fuelEntries?.map((f: any) => (
                  <tr key={f.id}>
                    <td className="font-mono text-xs text-[#F59E0B]">{f.entryNumber}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(f.date)}</td>
                    <td className="text-[#1A4A7A]">{String(f.liters ?? 0)}L</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed']">₹{Number(f.ratePerLiter ?? 0).toFixed(2)}</td>
                    <td className="text-[#16A34A] font-medium">{formatCurrency(f.totalCost)}</td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed'] text-xs">{f.fuelStation || '—'}</td>
                  </tr>
                ))}
                {!v.fuelEntries?.length && <tr><td colSpan={6}><EmptyState message="No fuel entries" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Maintenance' && (
            <table>
              <thead><tr><th>Type</th><th>Date</th><th>Cost</th><th>Status</th><th>Garage</th></tr></thead>
              <tbody>
                {v.maintenance?.map((m: any) => (
                  <tr key={m.id}>
                    <td className="text-[#1A4A7A] text-xs">{m.type?.replace(/_/g,' ')}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(m.date)}</td>
                    <td className="text-[#16A34A]">{formatCurrency(m.cost)}</td>
                    <td><StatusBadge status={m.status} /></td>
                    <td className="text-[#1A4A7A] font-['Barlow_Condensed'] text-xs">{m.garage || '—'}</td>
                  </tr>
                ))}
                {!v.maintenance?.length && <tr><td colSpan={5}><EmptyState message="No maintenance records" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Insurance' && (
            <table>
              <thead><tr><th>Provider</th><th>Policy #</th><th>Type</th><th>Premium</th><th>Expiry</th><th>Status</th></tr></thead>
              <tbody>
                {v.insurance?.map((i: any) => (
                  <tr key={i.id}>
                    <td className="text-[#0D2847] font-medium">{i.provider}</td>
                    <td className="font-mono text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{i.policyNumber}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{i.type}</td>
                    <td className="text-[#16A34A]">{formatCurrency(i.premium)}</td>
                    <td className="text-xs text-[#1A4A7A] font-['Barlow_Condensed']">{formatDate(i.endDate)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {!v.insurance?.length && <tr><td colSpan={6}><EmptyState message="No insurance" /></td></tr>}
              </tbody>
            </table>
          )}
          {tab === 'Documents' && (
            <div className="p-6">
              {v.documents?.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {v.documents.map((d: any) => (
                    <div key={d.id} className="bg-[#F4F6F8] border border-[#E0E8F0] rounded-xl p-4">
                      <p className="text-sm font-medium text-[#0D2847]">{d.type.replace(/_/g,' ')}</p>
                      <p className="text-xs text-[#7A9AB8] mt-1">Expires: {formatDate(d.expiryDate)}</p>
                    </div>
                  ))}
                </div>
              ) : <EmptyState message="No documents" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
