import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export function LoginPage() {
  const { login } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const data = await api.register({ email, password, name, tenantId, role });
        login(data.user, data.token);
      } else {
        const data = await api.login(email, password);
        login(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <div className="bg-slate-900/95 p-10 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Pulse Video Portal
        </h1>
        <p className="text-gray-400 mb-6 text-sm">
          {isRegister ? 'Create an account to start uploading videos.' : 'Sign in to your workspace.'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                Name
                <input
                  className="rounded-lg border border-gray-600 bg-gray-950 p-2.5 text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                Tenant / Organisation ID
                <input
                  className="rounded-lg border border-gray-600 bg-gray-950 p-2.5 text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-300">
                Role
                <select
                  className="rounded-lg border border-gray-600 bg-gray-950 p-2.5 text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-300">
            Email
            <input
              type="email"
              className="rounded-lg border border-gray-600 bg-gray-950 p-2.5 text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-300">
            Password
            <input
              type="password"
              className="rounded-lg border border-gray-600 bg-gray-950 p-2.5 text-gray-100 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full border-none py-3 px-5 bg-gradient-to-r from-green-500 to-blue-500 text-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed hover:from-green-600 hover:to-blue-600 transition-all mt-2"
            disabled={loading}
          >
            {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="w-full mt-4 bg-transparent border-none text-blue-400 cursor-pointer text-sm hover:underline"
          onClick={() => {
            setIsRegister((v) => !v);
            setError('');
          }}
        >
          {isRegister ? 'Already have an account? Sign in' : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

