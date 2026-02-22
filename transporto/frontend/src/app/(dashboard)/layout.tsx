'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Truck, Users, Route, Fuel, Wrench, AlertTriangle,
  Shield, Thermometer, Clock, MessageSquare, LogOut, Menu, X, Bell, Search
} from 'lucide-react';

const navGroups = [
  { label: null, items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { label: 'OPERATIONS', items: [
    { href: '/vehicles', label: 'Vehicles', icon: Truck },
    { href: '/drivers', label: 'Drivers', icon: Users },
    { href: '/trips', label: 'Trips', icon: Route },
    { href: '/fuel', label: 'Fuel', icon: Fuel },
  ]},
  { label: 'MONITORING', items: [
    { href: '/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/emergencies', label: 'Emergencies', icon: AlertTriangle },
    { href: '/insurance', label: 'Insurance', icon: Shield },
    { href: '/cold-storage', label: 'Cold Storage', icon: Thermometer },
  ]},
  { label: 'SYSTEM', items: [
    { href: '/shifts', label: 'Shifts', icon: Clock },
    { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  ]},
];

const allNavItems = navGroups.flatMap(g => g.items);
const roleBadge: Record<string, string> = {
  SUPER_ADMIN: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  MANAGER: 'bg-emerald-100 text-emerald-700',
  DRIVER: 'bg-amber-100 text-amber-700',
  COLD_STORAGE_OPERATOR: 'bg-cyan-100 text-cyan-700',
  VIEWER: 'bg-slate-100 text-slate-600',
};

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-sidebar)]">
      <div className="flex items-center justify-between px-5 py-5 border-b border-[var(--bg-sidebar-hover)]">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚛</span>
          <span className="text-lg font-bold text-white tracking-[0.2em]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>TRANSPORTO</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-[var(--text-on-sidebar)] hover:text-white lg:hidden rounded-lg">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label || 'main'}>
            {group.label && (
              <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-2">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all mx-1 h-11 ${
                      active
                        ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-on-sidebar-active)] font-semibold border-l-3 border-[var(--primary-400)]'
                        : 'text-[var(--text-on-sidebar)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[#e2e8f0]'
                    }`}
                    style={active ? { borderLeftWidth: '3px' } : undefined}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--bg-sidebar-hover)]">
        <div className="flex items-center gap-3 px-2 py-3 mb-1">
          <div className="w-10 h-10 rounded-full bg-[var(--primary-500)] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold mt-0.5 ${roleBadge[user?.role || ''] || 'bg-slate-600/30 text-slate-300'}`}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-on-sidebar)] hover:text-red-400 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-body)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-[var(--primary-500)] rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <p className="text-[var(--text-muted)] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const current = allNavItems.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)));
  const pageTitle = current?.label || 'Dashboard';
  const breadcrumb = pathname === '/dashboard' ? 'Overview' : pageTitle;

  return (
    <div className="flex h-screen bg-[var(--bg-body)] overflow-hidden">
      <aside className="hidden lg:block w-[260px] flex-shrink-0 border-r border-[var(--bg-sidebar-hover)]">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] shadow-xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="h-16 flex-shrink-0 bg-[var(--bg-header)] border-b border-[var(--border-light)] shadow-sm px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-table-header)] rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{pageTitle}</h1>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Dashboard &gt; {breadcrumb}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="search"
                placeholder="Search..."
                className="w-60 h-9 pl-9 pr-4 rounded-full bg-[var(--bg-body)] border border-[var(--border-light)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <button className="relative p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-table-header)] rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <div className="w-10 h-10 rounded-full bg-[var(--primary-500)] flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
