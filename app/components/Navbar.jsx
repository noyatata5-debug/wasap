'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, changePassword, logout } = useAuth();

  // Theme Mode State ('light' | 'dark')
  const [theme, setTheme] = useState('light');

  // Modal Ganti Password State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [isError, setIsError] = useState(false);

  // Initialize Theme from localStorage
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('wasap_theme');
      if (savedTheme === 'dark') {
        setTheme('dark');
        document.documentElement.classList.add('dark');
      } else {
        setTheme('light');
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('wasap_theme', 'dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('wasap_theme', 'light');
    }
  };

  if (!user) return null;

  const navLinks = [
    { href: '/', label: 'Workspace', icon: '🏠' },
    { href: '/finance', label: 'Finance', icon: '📈' },
  ];

  if (user.role === 'admin') {
    navLinks.push({ href: '/threads', label: 'Thread Admin', icon: '🧵' });
    navLinks.push({ href: '/admin', label: 'User Admin', icon: '👑' });
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
                  setToastMsg(null);
    setIsError(false);

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setToastMsg('Konfirmasi password baru tidak cocok!');
      return;
    }

    if (newPassword.length < 4) {
      setIsError(true);
      setToastMsg('Password baru minimal 4 karakter!');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      setToastMsg('Password berhasil diubah! Gunakan password baru untuk login berikutnya.');
      setIsError(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setToastMsg(null);
      }, 1500);
    } catch (err) {
      setIsError(true);
      setToastMsg(err.message || 'Gagal mengubah password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <nav className="bg-[var(--color-nav-bg)] backdrop-blur-md border-b border-[var(--color-card-border)] sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-2xl bg-[#2e96ff] text-white flex items-center justify-center font-black shadow-[rgba(154,207,246,0.6)_0px_4px_0px_0px] group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[var(--color-text-title)]">
                Wasap
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1.5 bg-[var(--color-subtle-bg)] p-1 rounded-full border border-[var(--color-card-border)]">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#13426f] dark:bg-[#2e96ff] text-white shadow-sm'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-title)] hover:bg-[var(--color-card-bg)]'
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
        </div>
      </div>

          {/* User Profile, Theme Switcher & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button (Light/Dark) */}
              <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-[var(--color-subtle-bg)] border border-[var(--color-card-border)] text-[var(--color-text-title)] hover:scale-105 transition text-sm flex items-center justify-center shadow-sm active:scale-95"
              title={theme === 'dark' ? 'Ganti ke Tema Cerah (Relief Warm Cream)' : 'Ganti ke Tema Gelap (Modern Dark)'}
              >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[var(--color-card-border)]">
              <div className="w-8 h-8 rounded-full bg-[#bde1f9] text-[#13426f] flex items-center justify-center text-xs font-bold font-mono">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[var(--color-text-main)]">@{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-[#bde1f9] text-[#13426f]">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] font-mono -mt-0.5">
                  +{user.phone_number}
                </span>
              </div>

              {/* Tombol Ganti Password Member */}
              <button
                onClick={() => {
                  setToastMsg(null);
                  setIsPasswordModalOpen(true);
                }}
                title="Ganti Password Login"
                className="px-2.5 py-1.5 rounded-full bg-[var(--color-card-bg)] hover:bg-[var(--color-subtle-bg)] border border-[var(--color-card-border)] text-[var(--color-text-title)] text-xs font-bold transition active:scale-95 flex items-center gap-1"
                >
                <span>🔑</span>
                <span className="hidden lg:inline">Ganti Pass</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="px-3 py-1.5 rounded-full bg-[var(--color-card-bg)] hover:bg-rose-500/15 border border-[var(--color-card-border)] hover:border-rose-400 text-[var(--color-text-muted)] hover:text-rose-500 text-xs font-semibold transition shadow-sm active:scale-95"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ganti Password Member */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relief-card w-full max-w-sm p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-card-border)]">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔑</span>
                <h3 className="text-base font-extrabold text-[var(--color-text-title)]">Ganti Password</h3>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[var(--color-subtle-bg)] text-[var(--color-text-muted)] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {toastMsg && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold text-center ${
                  isError
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                }`}
              >
                {isError ? '⚠️ ' : '✅ '} {toastMsg}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--color-text-title)]">Password Lama</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="relief-input w-full px-4 py-2 rounded-full text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--color-text-title)]">Password Baru</label>
                <input
                  type="password"
                  placeholder="Minimal 4 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="relief-input w-full px-4 py-2 rounded-full text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--color-text-title)]">Ulangi Password Baru</label>
                <input
                  type="password"
                  placeholder="Ketik ulang password baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="relief-input w-full px-4 py-2 rounded-full text-xs"
                  required
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 relief-btn-pop text-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
}

