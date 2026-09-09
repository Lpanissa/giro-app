import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';

export function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setSubmitting(true);
    setError(null);
    const err = await signInWithGoogle();
    if (err) setError(err);
    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-black shadow-lg">
        <span className="text-2xl font-bold tracking-wider text-white">
          <span className="text-[#00e699]">G</span>iro
        </span>
      </div>

      <h1 className="mt-6 text-xl font-bold text-slate-900">Bem-vindo ao Giro</h1>
      <p className="mt-1 text-center text-sm text-slate-500">
        Entre com sua conta Google para acessar seus dados em qualquer aparelho.
      </p>

      {error && (
        <div className="mt-4 w-full max-w-xs rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-600">
          {error}
        </div>
      )}

      <button
        onClick={handleSignIn}
        disabled={submitting}
        className="mt-8 flex w-full max-w-xs items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
          <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
        </svg>
        {submitting ? 'Entrando...' : 'Entrar com Google'}
      </button>
    </div>
  );
}
