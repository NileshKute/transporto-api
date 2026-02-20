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

const roleBadgeColor: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-500/20 text-purple-400',
  ADMIN: 'bg-blue-500/20 text-blue-400',
  MANAGER: 'bg-emerald-500/20 text-emerald-400',
  DRIVER: 'bg-amber-500/20 text-amber-400',
  COLD_STORAGE_OPERATOR: 'bg-cyan-500/20 text-cyan-400',
  VIEWER: 'bg-slate-500/20 text-slate-400',
};

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
        <div className="flex items-center gap-3 text-slate-400">
          <Truck className="w-6 h-6 text-blue-400 animate-pulse" />
          <span>Loading Transporto...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const pageTitle = navItems.find(n => pathname.startsWith(n.href))?.label || 'Dashboard';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <Truck className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="font-bold text-slate-100 text-sm tracking-wide">TRANSPORTO</p>
            <p className="text-xs text-slate-500">Fleet Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active
                  ? 'bg-blue-500/10 text-blue-400 border-r-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#1a2035]'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-[#1e293b]">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-sm flex-shrink-0">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadgeColor[user?.role || ''] || 'bg-slate-500/20 text-slate-400'}`}>
              {user?.role?.replace('_', ' ')}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0a0e1a] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] bg-[#111827] border-r border-[#1e293b] flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-[#111827] border-r border-[#1e293b] flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-[#111827] border-b border-[#1e293b] px-4 lg:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1a2035] rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-100">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1a2035] rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto bg-[#0a0e1a] p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
