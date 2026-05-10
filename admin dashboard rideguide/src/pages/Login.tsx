import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/Card';
import { login, logout, ApiError } from '../lib/api';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role !== 'admin') {
        logout();
        setError('Not an admin account. Administrator access is required; /api/admin/* was not called.');
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">RideGuide Admin</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Sign in with an admin account</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent-500 py-2 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
