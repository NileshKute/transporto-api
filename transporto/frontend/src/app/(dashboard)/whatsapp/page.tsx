'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatDateTime } from '@/lib/utils';
import { MessageSquare, Fuel, AlertTriangle, Route, MessageCircle } from 'lucide-react';

const typeIcon: Record<string, any> = {
  fuel: { icon: Fuel, color: 'text-amber-400 bg-amber-500/10' },
  emergency: { icon: AlertTriangle, color: 'text-red-400 bg-red-500/10' },
  trip: { icon: Route, color: 'text-blue-400 bg-blue-500/10' },
  general: { icon: MessageCircle, color: 'text-slate-400 bg-slate-500/10' },
};

export default function WhatsAppPage() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp', page, filterType, filterStatus],
    queryFn: () => api.get('/whatsapp', { params: { page, limit: 20, parsedType: filterType || undefined, status: filterStatus || undefined } }).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>WhatsApp</h2>
        <p className="text-sm text-[#475569]">Parsed incoming messages from drivers</p>
      </div>

      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 shadow-sm flex flex-wrap gap-3">
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} className="h-10 w-40 rounded-lg border border-[#cbd5e1] text-sm">
          <option value="">All Types</option>
          {['fuel','emergency','trip','general'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }} className="h-10 w-40 rounded-lg border border-[#cbd5e1] text-sm">
          <option value="">All Statuses</option>
          {['RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isLoading ? <LoadingSpinner /> : !data?.data?.length ? (
        <EmptyState message="No WhatsApp messages" description="Messages from drivers via Twilio webhook will appear here" />
      ) : (
        <div className="space-y-4">
          {data.data.map((msg: any) => {
            const ti = typeIcon[msg.parsedType] || typeIcon.general;
            const Icon = ti.icon;
            return (
              <div key={msg.id} className="bg-white border border-[#e2e8f0] rounded-xl p-5 shadow-sm hover:bg-[#f8fafc] transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl flex-shrink-0 ${ti.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#0f172a] text-sm">{msg.driver?.name || 'Unknown Driver'}</span>
                        <span className="mono text-xs text-[#94a3b8]">{msg.fromPhone}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${ti.color}`}>{msg.parsedType || 'general'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={msg.status} />
                        <span className="text-xs text-[#94a3b8]">{formatDateTime(msg.receivedAt)}</span>
                      </div>
                    </div>

                    <p className="text-sm text-[#475569] bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg p-3 mb-3 mono">"{msg.message}"</p>

                    {msg.parsedData && Object.keys(msg.parsedData).length > 0 && (
                      <div className="flex flex-wrap gap-3 mb-2">
                        {Object.entries(msg.parsedData).filter(([k, v]) => v != null).map(([k, v]) => (
                          <div key={k} className="bg-[#f1f5f9] border border-[#e2e8f0] rounded-lg px-3 py-1.5 text-sm text-[#475569]">
                            <p className="text-xs text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
                            <p className="text-sm font-semibold text-slate-200">{String(v)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Confidence */}
                    {msg.confidence != null && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500">Confidence:</span>
                        <div className="flex-1 max-w-[120px] h-1.5 bg-[#0a0e1a] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${msg.confidence >= 0.8 ? 'bg-emerald-500' : msg.confidence >= 0.6 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${msg.confidence * 100}%` }} />
                        </div>
                        <span className={`text-xs font-bold ${msg.confidence >= 0.8 ? 'text-emerald-400' : msg.confidence >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(msg.confidence * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={20} onPageChange={setPage} />}
    </div>
  );
}
