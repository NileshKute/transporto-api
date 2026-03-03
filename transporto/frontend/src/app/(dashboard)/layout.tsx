'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard, Truck, Users, Route, Fuel, Wrench,
  AlertTriangle, Shield, Snowflake, Clock, MessageSquare,
  LogOut, Bell, Search, Menu, X, ChevronRight
} from 'lucide-react';

const navGroups = [
  {
    label: 'OPERATIONS',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/vehicles', icon: Truck, label: 'Vehicles' },
      { href: '/drivers', icon: Users, label: 'Drivers' },
      { href: '/trips', icon: Route, label: 'Trips' },
      { href: '/fuel', icon: Fuel, label: 'Fuel' },
    ]
  },
  {
    label: 'MONITORING',
    items: [
      { href: '/maintenance', icon: Wrench, label: 'Maintenance' },
      { href: '/emergencies', icon: AlertTriangle, label: 'Emergencies' },
      { href: '/insurance', icon: Shield, label: 'Insurance' },
      { href: '/cold-storage', icon: Snowflake, label: 'Cold Storage' },
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/shifts', icon: Clock, label: 'Shifts' },
      { href: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
    ]
  }
];

function getPageTitle(pathname: string) {
  const map: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/vehicles': 'Vehicles',
    '/drivers': 'Drivers',
    '/trips': 'Trips',
    '/fuel': 'Fuel',
    '/maintenance': 'Maintenance',
    '/emergencies': 'Emergencies',
    '/insurance': 'Insurance',
    '/cold-storage': 'Cold Storage',
    '/shifts': 'Shifts',
    '/whatsapp': 'WhatsApp',
  };
  return map[pathname] || 'Dashboard';
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-50 flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-700/50">
          <span className="text-2xl">🚛</span>
          <span className="text-lg font-bold tracking-wide">TRANSPORTO</span>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-2">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
              {user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'User'}</p>
              <p className="text-[11px] text-slate-500">{user?.role?.replace(/_/g, ' ') || 'Role'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-64">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>Dashboard</span>
                <ChevronRight size={12} />
                <span>{pageTitle}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-60">
              <Search size={16} className="text-slate-400 mr-2" />
              <input className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400" placeholder="Search..." />
            </div>
            <button className="relative p-2 rounded-full hover:bg-slate-100">
              <Bell size={20} className="text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
              {user?.name?.[0] || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
