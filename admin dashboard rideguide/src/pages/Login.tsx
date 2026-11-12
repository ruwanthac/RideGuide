import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Eye, EyeOff, ShieldCheck, Activity, Users, AlertCircle } from 'lucide-react';
import { login, logout, ApiError } from '../lib/api';

const inputCls =
  'h-12 w-full rounded-xl border-[1.5px] border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-4 focus:ring-accent-500/15 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.role !== 'admin') {
        logout();
        setError('This account isn’t an admin. Sign in with an admin account to use the dashboard.');
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We couldn’t sign you in. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-100 dark:bg-gray-950 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-accent-500 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <Car className="h-6 w-6" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold">RideGuide</span>
            <span className="text-sm text-blue-100">Admin dashboard</span>
          </span>
        </div>
        <div className="mt-auto max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">Keep drivers moving.</h2>
          <p className="mt-3 text-[17px] leading-relaxed text-blue-100">Approve mechanics and tow trucks, watch live requests and keep an eye on the whole service from one place.</p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: ShieldCheck, text: 'Review provider documents and approve in one click' },
              { icon: Activity, text: 'See requests that are waiting for help, as they happen' },
              { icon: Users, text: 'Manage owners, mechanics and tow drivers' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <span aria-hidden className="pointer-events-none absolute -bottom-32 right-16 h-64 w-64 rounded-full bg-white/5" />
      </aside>

      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500 text-white">
              <Car className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">RideGuide Admin</span>
          </div>

          <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">Sign in</h1>
          <p className="mt-1.5 text-[15px] text-slate-500 dark:text-gray-400">Use your RideGuide admin account.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rideguide.lk"
                required
                autoFocus
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-gray-800"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="h-12 w-full rounded-xl bg-accent-500 text-[15px] font-bold text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-4 focus:ring-accent-500/30 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-gray-700"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500 dark:text-gray-400">Only admin accounts can sign in here.</p>
        </div>
      </main>
    </div>
  );
}
