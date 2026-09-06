'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, register } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (!username || !phone || !password) {
          throw new Error('Semua kolom registrasi wajib diisi!');
        }
        const createdUser = await register(username, phone, password);
        setSuccessMsg(`Selamat datang, ${createdUser.username}! Mengalihkan...`);
        setTimeout(() => {
          router.push('/');
        }, 800);
      } else {
        if (!identifier || !password) {
          throw new Error('Nomor WA / Username dan Password wajib diisi!');
        }
        await login(identifier, password);
        router.push('/');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal masuk. Silakan periksa kembali.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f7f0] flex items-center justify-center p-4 selection:bg-[#2e96ff] selection:text-white">
      <div className="relief-card w-full max-w-md p-8 sm:p-10 space-y-7 shadow-xl border border-[#e7e5dc]">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#2e96ff] text-white flex items-center justify-center text-2xl font-bold mx-auto shadow-[rgba(154,207,246,0.6)_0px_5px_0px_0px]">
            ⚡
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#13426f]">
            Wasap Hub
          </h1>
          <p className="text-xs text-[#616c8a]">
            {isRegisterMode
              ? 'Daftarkan nomor WhatsApp & akun workspace Anda'
              : 'Masuk dengan Nomor WhatsApp atau Username'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
            ✅ {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegisterMode ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#13426f]">Username</label>
                <input
                  type="text"
                  placeholder="cenot"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="relief-input w-full px-4 py-2.5 rounded-full text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#13426f]">Nomor WhatsApp</label>
                <input
                  type="text"
                  placeholder="6289637779993"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="relief-input w-full px-4 py-2.5 rounded-full text-xs font-mono font-bold"
                  required
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#13426f]">Nomor WA / Username</label>
              <input
                type="text"
                placeholder="6289637779993 atau cenot"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="relief-input w-full px-4 py-2.5 rounded-full text-xs font-medium"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#13426f]">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="relief-input w-full px-4 py-2.5 rounded-full text-xs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 relief-btn-pop text-xs font-bold uppercase tracking-wider disabled:opacity-50 mt-2"
          >
            {loading ? 'Memproses...' : isRegisterMode ? 'Daftar Sekarang' : 'Masuk ke Workspace'}
          </button>
        </form>

        <div className="pt-3 border-t border-[#e7e5dc] text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMsg(null);
            }}
            className="text-xs font-bold text-[#2e96ff] hover:underline"
          >
            {isRegisterMode ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Buat Akun Baru'}
          </button>
        </div>
      </div>
    </div>
  );
}
