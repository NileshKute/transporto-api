'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { LoadingSpinner, TableSkeleton } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate, formatIndianCurrency } from '@/lib/utils';
import { Truck, Users, Route, Fuel, Wrench, AlertTriangle, Shield, Snowflake, Building2, FileText, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

const CHART_COLORS = {
  primary: '#0D2847',
  secondary: '#1565C0',
  accent: '#42A5F5',
  light: '#64B5F6',
  mid: '#1A4A7A',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#DC2626',
  muted: '#7A9AB8',
};
const tooltipStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E0E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '12px', fontSize: '13px', fontFamily: 'Rajdhani, sans-serif' };

const weeklyTripData = [{ day: 'Mon', trips: 12 }, { day: 'Tue', trips: 19 }, { day: 'Wed', trips: 8 }, { day: 'Thu', trips: 15 }, { day: 'Fri', trips: 22 }, { day: 'Sat', trips: 10 }, { day: 'Sun', trips: 5 }];
const vehicleStatusData = [
  { name: 'Active', value: 28, color: CHART_COLORS.success },
  { name: 'Maintenance', value: 5, color: CHART_COLORS.warning },
  { name: 'Idle', value: 12, color: CHART_COLORS.mid },
  { name: 'Breakdown', value: 2, color: CHART_COLORS.danger },
];

function SectionHeader({ title, href, subtitle }: { title: string; href: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847]">{title}</h3>
        {subtitle && <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-0.5">{subtitle}</p>}
      </div>
      <Link href={href} className="text-sm text-[#1565C0] hover:text-[#0D2847] font-medium transition-colors font-['Barlow_Condensed'] uppercase tracking-wider">
        View all →
      </Link>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E8F0] rounded-lg shadow-sm p-5">
      <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847]">{title}</h3>
      {subtitle && <p className="font-['Rajdhani'] text-xs text-[#7A9AB8] mt-0.5 mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: sl } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: recent, isLoading: rl } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: () => api.get('/dashboard/recent').then(r => r.data),
  });
  const { data: invoicesRaw } = useQuery({
    queryKey: ['invoices-list'],
    queryFn: async () => {
      const res = await api.get('/invoices', { params: { limit: 500 } });
      return res.data?.data ?? res.data ?? [];
    },
  });
  const { data: clientsRaw } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get('/clients');
      return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
    },
  });
  const { data: vehiclesRaw } = useQuery({
    queryKey: ['vehicles-list'],
    queryFn: () => api.get('/vehicles?limit=500').then(r => r.data?.data ?? r.data ?? []),
  });
  const { data: tripsRaw } = useQuery({
    queryKey: ['trips-list'],
    queryFn: async () => {
      const res = await api.get('/trips', { params: { limit: 500 } });
      return res.data?.data ?? res.data ?? [];
    },
  });
  const { data: expirySummary } = useQuery({
    queryKey: ['vehicle-expiry-summary'],
    queryFn: () => api.get('/vehicles/expiry-summary').then(r => r.data),
  });

  const invoices = Array.isArray(invoicesRaw) ? invoicesRaw : [];
  const clients = Array.isArray(clientsRaw) ? clientsRaw : [];
  const vehicles = Array.isArray(vehiclesRaw) ? vehiclesRaw : [];
  const trips = Array.isArray(tripsRaw) ? tripsRaw : [];

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const {
    monthlyRevenue,
    activeVehiclesCount,
    tripsThisMonth,
    pendingInvoicesCount,
    overdueCount,
    activeClientsCount,
    revenueTrendLast6,
    invoiceStatusBreakdown,
    topClientsByRevenue,
    vehicleUtilization,
  } = useMemo(() => {
    let monthlyRevenue = 0;
    let pendingInvoicesCount = 0;
    let overdueCount = 0;
    const byMonth: Record<string, number> = {};
    const byStatus: Record<string, number> = { PAID: 0, DRAFT: 0, SENT: 0, PARTIAL: 0, OVERDUE: 0, CANCELLED: 0 };
    const byClient: Record<string, { name: string; revenue: number }> = {};

    for (let m = 5; m >= 0; m--) {
      const d = new Date(thisYear, thisMonth - m, 1);
      byMonth[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
    }

    invoices.forEach((inv: any) => {
      const amount = Number(inv.totalAmount) || 0;
      const status = inv.status || 'DRAFT';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (status === 'PAID') {
        const d = inv.updatedAt ? new Date(inv.updatedAt) : inv.createdAt ? new Date(inv.createdAt) : null;
        if (d && d.getMonth() === thisMonth && d.getFullYear() === thisYear) monthlyRevenue += (Number(inv.amountPaid) || amount);
        const key = `${d?.getFullYear() ?? thisYear}-${String((d?.getMonth() ?? thisMonth) + 1).padStart(2, '0')}`;
        if (byMonth[key] !== undefined) byMonth[key] += (Number(inv.amountPaid) || amount);
      }
      if (status === 'DRAFT' || status === 'SENT') pendingInvoicesCount += 1;
      if (status === 'OVERDUE') overdueCount += 1;
      const cid = inv.clientId;
      if (cid) {
        if (!byClient[cid]) byClient[cid] = { name: (inv.client as any)?.name ?? 'Client', revenue: 0 };
        byClient[cid].revenue += amount;
      }
    });

    const revenueTrendLast6 = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, value]) => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
        return { month: label, revenue: value };
      });

    const invoiceStatusBreakdown = [
      { name: 'PAID', value: byStatus.PAID || 0, color: CHART_COLORS.success },
      { name: 'PENDING', value: (byStatus.DRAFT || 0) + (byStatus.SENT || 0) + (byStatus.PARTIAL || 0), color: CHART_COLORS.warning },
      { name: 'OVERDUE', value: byStatus.OVERDUE || 0, color: CHART_COLORS.danger },
      { name: 'DRAFT', value: byStatus.DRAFT || 0, color: CHART_COLORS.muted },
    ].filter(d => d.value > 0);

    const clientNames: Record<string, string> = {};
    clients.forEach((c: any) => { clientNames[c.id] = c.name; });
    const topClientsByRevenue = Object.entries(byClient)
      .map(([id, o]) => ({ clientId: id, name: clientNames[id] || o.name, revenue: o.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const activeVehiclesCount = vehicles.filter((v: any) => v.status === 'ACTIVE').length;
    const tripsThisMonth = trips.filter((t: any) => {
      const d = t.startTime ? new Date(t.startTime) : t.createdAt ? new Date(t.createdAt) : null;
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const activeClientsCount = clients.filter((c: any) => c.isActive !== false).length;

    const vehicleTripCount: Record<string, number> = {};
    trips.forEach((t: any) => {
      if (!t.startTime) return;
      const d = new Date(t.startTime);
      if (d.getMonth() !== thisMonth || d.getFullYear() !== thisYear) return;
      const vid = t.vehicleId || t.vehicle?.id;
      if (vid) vehicleTripCount[vid] = (vehicleTripCount[vid] || 0) + 1;
    });
    const vehicleUtilization = vehicles
      .slice(0, 10)
      .map((v: any) => ({ name: v.regNumber || v.reg_number || 'Vehicle', trips: vehicleTripCount[v.id] || 0 }))
      .filter((x: any) => x.trips > 0)
      .sort((a: any, b: any) => b.trips - a.trips)
      .slice(0, 8);
    if (vehicleUtilization.length === 0 && vehicles.length > 0) {
      vehicles.slice(0, 5).forEach((v: any) => vehicleUtilization.push({ name: v.regNumber || v.reg_number || 'Vehicle', trips: 0 }));
    }

    return {
      monthlyRevenue,
      activeVehiclesCount: stats?.vehicles?.active ?? activeVehiclesCount,
      tripsThisMonth: stats?.trips?.thisMonth ?? tripsThisMonth,
      pendingInvoicesCount,
      overdueCount,
      activeClientsCount,
      revenueTrendLast6,
      invoiceStatusBreakdown: invoiceStatusBreakdown.length ? invoiceStatusBreakdown : [{ name: 'No data', value: 1, color: CHART_COLORS.muted }],
      topClientsByRevenue,
      vehicleUtilization,
    };
  }, [invoices, clients, vehicles, trips, stats, thisMonth, thisYear]);

  if (sl) return <LoadingSpinner text="Loading dashboard..." />;

  const pendingEmergencies = stats?.emergencies?.pending ?? recent?.emergencies?.filter((e: any) => e.status === 'PENDING' || e.status === 'ACKNOWLEDGED').length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatCard icon={Truck} iconColor="blue" title="Total Vehicles" value={stats?.vehicles?.total ?? vehicles.length} subtitle={`${activeVehiclesCount} active`} />
        <StatCard icon={Users} iconColor="green" title="Active Drivers" value={stats?.drivers?.total ?? 0} subtitle={`${stats?.drivers?.onTrip ?? 0} on trip`} />
        <StatCard icon={Route} iconColor="purple" title="Today's Trips" value={stats?.trips?.today ?? 0} subtitle="Active today" />
        <StatCard icon={Fuel} iconColor="amber" title="Fuel Spend" value={formatCurrency(stats?.fuel?.totalCost)} subtitle="All time" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <Link href="/invoices">
          <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#42A5F5]" />
            </div>
            <div>
              <p className="font-['Oswald'] text-xl font-bold text-[#0D2847]">{formatIndianCurrency(monthlyRevenue)}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Monthly Revenue</p>
            </div>
          </div>
        </Link>
        <Link href="/vehicles">
          <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#1565C0]/10 flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#1565C0]" />
            </div>
            <div>
              <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{activeVehiclesCount}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Active Vehicles</p>
            </div>
          </div>
        </Link>
        <Link href="/trips">
          <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#42A5F5]/10 flex items-center justify-center">
              <Route className="w-6 h-6 text-[#42A5F5]" />
            </div>
            <div>
              <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{tripsThisMonth}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Trips This Month</p>
            </div>
          </div>
        </Link>
        <Link href="/invoices">
          <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#F59E0B]" />
            </div>
            <div>
              <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{pendingInvoicesCount}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Pending Invoices</p>
            </div>
          </div>
        </Link>
        <Link href="/invoices?status=OVERDUE">
          <div className="bg-white rounded-xl border border-[#E0E8F0] border-l-4 border-l-[#DC2626] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#DC2626]/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#DC2626]" />
            </div>
            <div>
              <p className={`font-['Oswald'] text-2xl font-bold ${overdueCount > 0 ? 'text-[#DC2626]' : 'text-[#7A9AB8]'}`}>{overdueCount}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Overdue Payments</p>
            </div>
          </div>
        </Link>
        <Link href="/clients">
          <div className="bg-white rounded-xl border border-[#E0E8F0] p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer">
            <div className="w-12 h-12 rounded-xl bg-[#16A34A]/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#16A34A]" />
            </div>
            <div>
              <p className="font-['Oswald'] text-2xl font-bold text-[#0D2847]">{activeClientsCount}</p>
              <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">Active Clients</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Docs Expired', value: expirySummary?.expired ?? 0, icon: FileWarning, border: 'border-l-[#DC2626]', iconClass: 'text-[#DC2626]', href: '/vehicles' },
          { label: 'Docs Expiring Soon', value: expirySummary?.expiringSoon ?? 0, icon: FileWarning, border: 'border-l-[#F59E0B]', iconClass: 'text-[#F59E0B]', href: '/vehicles' },
          { label: 'Active Maintenance', value: stats?.maintenance?.active ?? 0, icon: Wrench, border: 'border-l-[#F59E0B]', iconClass: 'text-[#F59E0B]', href: '/maintenance' },
          { label: 'Pending Emergencies', value: stats?.emergencies?.pending ?? 0, icon: AlertTriangle, border: 'border-l-[#DC2626]', iconClass: 'text-[#DC2626]', href: '/emergencies' },
          { label: 'Expiring Insurance', value: stats?.insurance?.expiring ?? 0, icon: Shield, border: 'border-l-[#F59E0B]', iconClass: 'text-[#F59E0B]', href: '/insurance' },
          { label: 'Cold Storage Alerts', value: stats?.coldStorage?.alerts ?? 0, icon: Snowflake, border: 'border-l-[#42A5F5]', iconClass: 'text-[#42A5F5]', href: '/cold-storage' },
        ].map(({ label, value, icon: Icon, border, iconClass, href }) => (
          <Link key={label} href={href}>
            <div className={`bg-white rounded-xl border border-[#E0E8F0] border-l-4 ${border} p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition-all cursor-pointer`}>
              <div className={`p-2.5 rounded-xl ${iconClass} bg-current/10`}><Icon className="w-5 h-5" /></div>
              <div>
                <p className={`font-['Oswald'] text-2xl font-bold ${value > 0 ? iconClass : 'text-[#7A9AB8]'}`}>{value}</p>
                <p className="font-['Barlow_Condensed'] text-xs text-[#7A9AB8] uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <ChartCard title="Monthly Revenue Trend" subtitle="Last 6 months — PAID invoices">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueTrendLast6} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F8" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatIndianCurrency(value), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.secondary} fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Invoice Status Breakdown" subtitle="By count">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={invoiceStatusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                {invoiceStatusBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <ChartCard title="Top 5 Clients by Revenue" subtitle="All time">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topClientsByRevenue} layout="vertical" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F8" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatIndianCurrency(value), 'Revenue']} />
              <Bar dataKey="revenue" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Vehicle Utilization" subtitle="Trips per vehicle this month">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={vehicleUtilization} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F8" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Bar dataKey="trips" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-5">
          <SectionHeader title="Weekly Trip Activity" href="/trips" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyTripData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F4F6F8" />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <YAxis tick={{ fontSize: 12, fill: '#7A9AB8' }} axisLine={{ stroke: '#E0E8F0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Bar dataKey="trips" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm p-5">
          <h3 className="font-['Oswald'] text-base font-semibold text-[#0D2847] mb-4">Vehicle Status</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                {vehicleStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: any) => [`${value}`, name]} />
              <Legend layout="horizontal" align="center" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E0E8F0]">
            <SectionHeader title="Recent Trips" href="/trips" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Trip #</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Route</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {recent?.trips?.slice(0, 5).map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F4F6F8] transition-colors">
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani']"><span className="font-mono font-bold text-[#1565C0]">{t.tripNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani']"><span className="font-mono">{t.vehicle?.regNumber}</span></td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] truncate max-w-[160px]">{t.startLocation?.split('(')[0].trim()} → {t.endLocation?.split('(')[0].trim() || '...'}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    </tr>
                  ))}
                  {!recent?.trips?.length && <tr><td colSpan={4} className="text-center py-8 text-[#7A9AB8] text-sm font-['Rajdhani']">No trips yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[#E0E8F0] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E0E8F0]">
            <SectionHeader title="Recent Fuel Entries" href="/fuel" />
          </div>
          {rl ? <TableSkeleton rows={5} cols={4} /> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F4F6F8] border-b border-[#E0E8F0]">
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Vehicle</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Liters</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Cost</th>
                    <th className="text-left px-4 py-3 font-['Barlow_Condensed'] text-xs font-semibold uppercase tracking-wider text-[#1A4A7A]">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E8F0]">
                  {recent?.fuelEntries?.slice(0, 5).map((f: any) => (
                    <tr key={f.id} className="hover:bg-[#F4F6F8] transition-colors">
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] font-mono font-semibold">{f.vehicle?.regNumber}</td>
                      <td className="px-4 py-3.5 text-sm text-[#0D2847] font-['Rajdhani'] font-mono">{f.liters} L</td>
                      <td className="px-4 py-3.5 text-sm text-[#16A34A] font-['Rajdhani'] font-mono font-semibold">{formatCurrency(f.totalCost)}</td>
                      <td className="px-4 py-3.5 text-sm text-[#7A9AB8] font-['Rajdhani']">{formatDate(f.fuelDate)}</td>
                    </tr>
                  ))}
                  {!recent?.fuelEntries?.length && <tr><td colSpan={4} className="text-center py-8 text-[#7A9AB8] text-sm font-['Rajdhani']">No fuel entries</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {pendingEmergencies > 0 && (
        <AlertBanner
          type="danger"
          title={`${pendingEmergencies} Active Emergency${pendingEmergencies > 1 ? 's' : ''} Require Attention`}
          action={{ label: 'View All', onClick: () => window.location.href = '/emergencies' }}
        />
      )}
    </div>
  );
}
