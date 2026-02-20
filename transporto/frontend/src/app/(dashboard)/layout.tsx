'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Truck, Users, Route, Fuel, Wrench, AlertTriangle,
  Shield, Thermometer, Clock, MessageSquare, LogOut, Menu, X, Bell, ChevronRight
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vehicles', label: 'Vehicles', icon: Truck },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/trips', label: 'Trips', icon: Route },
  { href: '/fuel', label: 'Fuel', icon: Fuel },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/emergencies', label: 'Emergencies', icon: AlertTriangle },
  { href: '/insurance', label: 'Insurance', icon: Shield },
  { href: '/cold-storage', label: 'Cold Storage', icon: Thermometer },
  { href: '/shifts', label: 'Shifts', icon: Clock },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
];

const roleBadge: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  ADMIN: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  MANAGER: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  DRIVER: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  COLD_STORAGE_OPERATOR: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
  VIEWER: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
};

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-[#0d1424]">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-[#1a2235]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/30">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-widest">TRANSPORTO</p>
            <p className="text-[10px] text-slate-600">Fleet Management</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 lg:hidden">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mb-2">Navigation</p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group relative ${
                active
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-white/4'
              }`}
            >
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r-full" />}
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-600 group-hover:text-slate-400'}`} />
              <span className="font-medium">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto text-blue-500/50" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-[#1a2235]">
        <div className="flex items-center gap-3 px-2 py-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md font-semibold mt-0.5 ${roleBadge[user?.role || ''] || 'bg-slate-700 text-slate-400'}`}>
              {user?.role?.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/8 rounded-lg transition-all">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const pageTitle = navItems.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[240px] flex-shrink-0 border-r border-[#1a2235]">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[240px] border-r border-[#1a2235] shadow-2xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="bg-[#0d1424] border-b border-[#1a2235] px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-100">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors">
              <Bell className="w-4.5 h-4.5" style={{width:'18px',height:'18px'}} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-[#0d1424]" />
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs shadow-md">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
