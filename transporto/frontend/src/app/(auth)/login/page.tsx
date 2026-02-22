'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { Truck, Eye, EyeOff, Loader2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'admin@transporto.in', pass: 'admin123' },
  { role: 'Manager', email: 'priya@transporto.in', pass: 'admin123' },
  { role: 'Driver', email: 'rajesh@transporto.in', pass: 'driver123' },
];

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
      const msg = err?.response?.data?.message || err?.message || 'Something went wrong. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Branded panel — 55% */}
      <div
        className="hidden lg:flex flex-col justify-between w-[55%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0f2744 0%, #1e3a5f 100%)' }}
      >
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <span className="text-4xl">🚛</span>
            <span className="text-[36px] font-extrabold text-white tracking-[0.2em]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              TRANSPORTO
            </span>
          </div>
          <p className="text-base text-[#93c5fd] mb-12">Fleet & Cold Storage Management System</p>
          <div className="space-y-5">
            {[
              { icon: '🚛', text: 'Track 50+ vehicles in real-time' },
              { icon: '❄️', text: 'Monitor cold storage 24/7' },
              { icon: '📊', text: 'Complete business analytics' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-4 text-[#cbd5e1] text-sm">
                <span className="text-xl">{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-[#64748b]">Trusted by Indian transport businesses</p>
      </div>

      {/* Right: Login form — 45% */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-[400px]">
          <h2 className="text-2xl font-bold text-[#0f172a] mb-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Welcome back
          </h2>
          <p className="text-sm text-[#475569] mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="h-12 rounded-lg border border-[#cbd5e1] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#dbeafe]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="h-12 rounded-lg border border-[#cbd5e1] focus:border-[#3b82f6] focus:ring-2 focus:ring-[#dbeafe] w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a]"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Demo Accounts</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map(({ role, email: e, pass }) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { setEmail(e); setPassword(pass); }}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#f1f5f9] hover:bg-[#eff6ff] border border-transparent hover:border-[#e2e8f0] transition-colors text-left"
                >
                  <span className="text-sm font-medium text-[#0f172a]">{role}</span>
                  <span className="text-xs text-[#94a3b8] font-mono">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
