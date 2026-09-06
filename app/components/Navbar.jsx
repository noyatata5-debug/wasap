'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) return null;

  // Base navigation links
  const navLinks = [
    { href: '/', label: 'Workspace', icon: '🏠' },
    { href: '/finance', label: 'Finance', icon: '📈' },
  ];

  // Admin-only links
  if (user.role === 'admin') {
    navLinks.push({ href: '/threads', label: 'Thread Admin', icon: '🧵' });
    navLinks.push({ href: '/admin', label: 'User Admin', icon: '👑' });
  }

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-[#e7e5dc] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Clean Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-2xl bg-[#2e96ff] text-white flex items-center justify-center font-black shadow-[rgba(154,207,246,0.6)_0px_4px_0px_0px] group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <span className="font-extrabold text-lg tracking-tight text-[#13426f]">
                Wasap
              </span>
            </Link>
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1.5 bg-[#f9f7f0] p-1 rounded-full border border-[#e7e5dc]">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-[#13426f] text-white shadow-sm'
                        : 'text-[#616c8a] hover:text-[#13426f] hover:bg-white'
                    }`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {/* Mobile Nav Icons */}
            <div className="flex md:hidden items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`p-2 rounded-full text-sm transition ${
                      isActive
                        ? 'bg-[#13426f] text-white'
                        : 'text-[#616c8a] hover:bg-[#f1ede1]'
                    }`}
                    title={link.label}
                  >
                    <span>{link.icon}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#e7e5dc]">
              <div className="w-8 h-8 rounded-full bg-[#bde1f9] text-[#13426f] flex items-center justify-center text-xs font-bold font-mono">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#212121]">@{user.username}</span>
                  {user.role === 'admin' && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-full bg-[#bde1f9] text-[#13426f]">
                      Admin
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#616c8a] font-mono -mt-0.5">
                  +{user.phone_number}
                </span>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="ml-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-rose-50 border border-[#d0d5dd] hover:border-rose-300 text-[#616c8a] hover:text-rose-600 text-xs font-semibold transition shadow-sm active:scale-95"
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

