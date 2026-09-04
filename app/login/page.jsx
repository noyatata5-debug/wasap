'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, normalizePhoneNumber } from '../../lib/authContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, register } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState(''); // username or phone
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!identifier.trim() || !password) {
        throw new Error('Harap isi Username/Nomor WA dan Password.');
      }
      await login(identifier, password);
      router.push('/');
    } catch (err) {
      setErrorMsg(err.message || 'Gagal masuk. Silakan periksa kembali akun Anda.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!username.trim() || !phone.trim() || !password) {
        throw new Error('Harap lengkapi semua kolom pendaftaran.');
      }
      const createdUser = await register(username, phone, password);
      setSuccessMsg(`Selamat datang, ${createdUser.username}! Mengalihkan ke dashboard...`);
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-emerald-500 selection:text-black overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none animate-pulse-subtle" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-glow-emerald mb-2">
            <svg className="w-8 h-8 text-slate-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Wasap Daily Hub
          </h1>
          <p className="text-sm text-slate-400">
            {mode === 'login'
              ? 'Masuk untuk mengakses workspace & riwayat keuangan Anda'
              : 'Daftarkan nomor WhatsApp untuk sinkronisasi otomatis'}
          </p>
        </div>

        {/* Card Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass border border-white/10 space-y-6 backdrop-blur-2xl">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2.5 rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Masuk (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2.5 rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daftar Akun Baru
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-fade-in">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Content */}
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Username atau Nomor WhatsApp
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    👤
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: ahmad atau 08123456789"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    🔒
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Masukkan password Anda"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-bold text-sm shadow-glow-violet transition-all mt-2"
              >
                {loading ? 'Memeriksa Akun...' : 'Masuk ke Dashboard'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    👤
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Pilih nama panggilan (contoh: ahmad)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-300">Nomor WhatsApp</label>
                  <span className="text-[10px] text-emerald-400 font-medium">Auto-format 628...</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    📱
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 08123456789 / 628123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm placeholder:text-slate-600 font-mono"
                  />
                </div>
                {phone && (
                  <p className="text-[11px] text-slate-400">
                    Format WA: <span className="text-emerald-400 font-mono font-semibold">+{normalizePhoneNumber(phone)}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                    🔒
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Buat password minimal 4 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-3 rounded-xl text-sm placeholder:text-slate-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:opacity-90 active:scale-98 disabled:opacity-50 text-white font-bold text-sm shadow-glow-emerald transition-all mt-2"
              >
                {loading ? 'Mendaftarkan Akun...' : 'Daftar & Mulai'}
              </button>
            </form>
          )}

          {/* Quick Note */}
          <div className="pt-4 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500 leading-relaxed">
              💡 Nomor WhatsApp digunakan untuk menghubungkan chat bot WA langsung ke dashboard pribadimu.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
