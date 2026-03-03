'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Truck, Snowflake, BarChart3 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const demoAccounts = [
  { role: 'Super Admin', email: 'admin@transporto.in', password: 'admin123', icon: '👨‍💼' },
  { role: 'Manager', email: 'priya@transporto.in', password: 'admin123', icon: '👩‍💼' },
  { role: 'Driver', email: 'rajesh@transporto.in', password: 'driver123', icon: '🚛' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (account: typeof demoAccounts[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 w-full">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-5xl">🚛</span>
              <span className="text-4xl font-extrabold text-white tracking-tight">TRANSPORTO</span>
            </div>
            <p className="text-xl text-blue-200 font-medium">Fleet & Cold Storage Management System</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-4 text-blue-100">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="font-semibold text-white">Track Vehicles in Real-time</p>
                <p className="text-sm text-blue-300">Monitor your entire fleet from one dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-blue-100">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Snowflake className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="font-semibold text-white">Cold Storage Monitoring 24/7</p>
                <p className="text-sm text-blue-300">Temperature alerts and live monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-blue-100">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <p className="font-semibold text-white">Complete Business Analytics</p>
                <p className="text-sm text-blue-300">Fuel costs, trip reports, and more</p>
              </div>
            </div>
          </div>

          <p className="mt-16 text-sm text-slate-500">Trusted by Indian transport businesses</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <span className="text-3xl">🚛</span>
            <span className="text-2xl font-bold text-slate-900">TRANSPORTO</span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back</h1>
          <p className="text-slate-500 mb-8">Sign in to your account</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Demo Accounts</p>
            <div className="space-y-2">
              {demoAccounts.map(account => (
                <button
                  key={account.email}
                  onClick={() => fillDemo(account)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{account.icon}</span>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700">{account.role}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{account.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
