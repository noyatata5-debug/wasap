'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) return null;

  // Base navigation links visible to all members
  const navLinks = [
    { href: '/', label: 'Workspace & Kalender', icon: '🏠' },
    { href: '/finance', label: 'Personal Finance', icon: '📈' },
  ];

  // Admin-only menu items
  if (user.role === 'admin') {
    navLinks.push({ href: '/threads', label: 'Thread Admin (Yap)', icon: '🧵' });
    navLinks.push({ href: '/admin', label: 'User Admin', icon: '👑' });
  }

  return (
    <nav className="glass-panel border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-indigo-500 flex items-center justify-center text-slate-950 font-black shadow-glow-emerald group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <div className="hidden sm:block">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Wasap Hub
                </span>
                <span className="text-[10px] block text-emerald-400 font-mono -mt-1">
                  +{user.phone_number}
                </span>
              </div>
            </Link>

            {/* Navigation Pills */}
            <div className="hidden md:flex items-center gap-1.5 ml-4 bg-slate-950/60 p-1 rounded-2xl border border-slate-800">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            {/* Mobile Nav Links Buttons */}
            <div className="flex md:hidden items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`p-2 rounded-xl text-sm transition ${
                      isActive
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title={link.label}
                  >
                    <span>{link.icon}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center text-[11px] font-bold text-slate-950">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="items-center gap-1.5 hidden lg:flex">
                <span className="text-xs font-medium text-slate-300">
                  @{user.username}
                </span>
                {user.role === 'admin' && (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 text-xs font-medium transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
