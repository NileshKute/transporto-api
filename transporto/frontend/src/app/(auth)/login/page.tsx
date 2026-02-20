'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Truck, Eye, EyeOff, Loader2, Shield, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@transporto.in');
  const [password, setPassword] = useState('admin123');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      router.replace('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Left: Branding Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-[#060b16] border-r border-[#1e293b] p-12 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/5 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-wide">TRANSPORTO</span>
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Fleet Management<br />
            <span className="text-blue-400">Made Simple</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Complete Transportation Fleet & Cold Storage Management System for modern logistics operations.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: Truck, label: 'Vehicle & Driver Management', desc: 'Real-time fleet tracking' },
            { icon: Shield, label: 'Insurance & Compliance', desc: 'Never miss an expiry' },
            { icon: Zap, label: 'Cold Storage Monitoring', desc: 'Live temperature alerts' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4 p-3 rounded-xl bg-white/3 border border-white/5">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative text-xs text-slate-600">© 2026 Transporto. All rights reserved.</p>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">TRANSPORTO</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-1">Sign in</h2>
          <p className="text-sm text-slate-500 mb-8">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@transporto.in"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In →'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-[#111827] rounded-xl border border-[#1e293b]">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Demo Accounts</p>
            <div className="space-y-2">
              {[
                { role: 'Super Admin', email: 'admin@transporto.in', pass: 'admin123', color: 'text-purple-400' },
                { role: 'Manager', email: 'priya@transporto.in', pass: 'admin123', color: 'text-emerald-400' },
                { role: 'Driver', email: 'rajesh@transporto.in', pass: 'driver123', color: 'text-amber-400' },
              ].map(({ role, email: e, pass, color }) => (
                <button key={e} onClick={() => { setEmail(e); setPassword(pass); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[#1a2035] transition-colors text-left group">
                  <span className={`text-xs font-medium ${color}`}>{role}</span>
                  <span className="text-xs text-slate-600 group-hover:text-slate-400 font-mono">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
