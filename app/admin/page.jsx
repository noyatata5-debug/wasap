'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Auth Protection Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);

  // Load Admin Data
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  async function fetchAdminData() {
    setDataLoading(true);
    try {
      const [
        { data: uData, error: uErr },
        { count: tCount, error: tErr },
        { count: eCount, error: eErr },
      ] = await Promise.all([
        supabase.from('users').select('*').order('id', { ascending: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }),
        supabase.from('expenses').select('*', { count: 'exact', head: true }),
      ]);

      if (uErr) console.error('Fetch users error:', uErr);
      if (tErr) console.error('Fetch tasks error:', tErr);
      if (eErr) console.error('Fetch expenses error:', eErr);

      if (uData) setUsersList(uData);
      if (tCount !== null) setTotalTasksCount(tCount);
      if (eCount !== null) setTotalExpensesCount(eCount);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setDataLoading(false);
    }
  }

  async function toggleRole(targetUser) {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: nextRole })
        .eq('id', targetUser.id);

      if (error) throw error;
      setUsersList(prev =>
        prev.map(u => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
      );
      showToast(`Role ${targetUser.username} diubah menjadi ${nextRole.toUpperCase()}`);
    } catch (err) {
      showToast('Gagal mengubah role', 'error');
      console.error(err);
    }
  }

  async function deleteUser(id, username) {
    if (!confirm(`Yakin ingin menghapus akun @${username}?`)) return;

    try {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
      setUsersList(prev => prev.filter(u => u.id !== id));
      showToast(`User @${username} berhasil dihapus`);
    } catch (err) {
      showToast('Gagal menghapus user', 'error');
      console.error(err);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        (u.phone_number && u.phone_number.includes(q))
    );
  }, [usersList, searchQuery]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat sesi admin...</span>
        </div>
      </div>
    );
  }

  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-md text-center space-y-4">
          <span className="text-4xl">🔒</span>
          <h2 className="text-xl font-bold text-white">Akses Ditolak</h2>
          <p className="text-sm text-slate-400">
            Halaman ini khusus untuk Administrator. Akun Anda (<span className="text-emerald-400 font-semibold">{user.username}</span>) memiliki role Member.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
          >
            Kembali ke Workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-emerald-500 selection:text-black pb-16">
      {/* Dynamic Background Glows */}
      <div className="fixed top-0 left-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* --- HEADER --- */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center shadow-glow-violet text-white font-bold">
                👑
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Admin Control Panel
                </h1>
                <p className="text-xs text-slate-400">
                  Kelola data pengguna, nomor WhatsApp terdaftar, dan status sistem
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-slate-200 transition"
            >
              <span>← Kembali ke Workspace</span>
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-sm font-semibold transition"
            >
              Keluar (Logout)
            </button>
          </div>
        </header>

        {/* --- STATS OVERVIEW --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Pengguna Terdaftar</span>
            <p className="text-3xl font-black text-white">{usersList.length}</p>
            <p className="text-xs text-slate-500">Akun dengan nomor WA terhubung</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Tugas Tercatat</span>
            <p className="text-3xl font-black text-blue-400">{totalTasksCount}</p>
            <p className="text-xs text-slate-500">Semua tugas di sistem database</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Transaksi Pengeluaran</span>
            <p className="text-3xl font-black text-emerald-400">{totalExpensesCount}</p>
            <p className="text-xs text-slate-500">Semua catatan pengeluaran masuk</p>
          </div>
        </div>

        {/* --- USERS MANAGEMENT TABLE --- */}
        <section className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👥 Daftar Pengguna & Nomor WhatsApp</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {filteredUsers.length} User
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pemisahan data bekerja otomatis berdasarkan kolom nomor WhatsApp
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari username / no WA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="glass-input w-full pl-9 pr-4 py-2 rounded-xl text-xs placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Nomor WhatsApp</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Terdaftar</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dataLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Tidak ada pengguna yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.id === user.id;
                    return (
                      <tr key={u.id} className="hover:bg-slate-900/50 transition">
                        <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs">
                            {u.username.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{u.username}</span>
                          {isSelf && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                              (Anda)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs">
                          <a
                            href={`https://wa.me/${u.phone_number}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline flex items-center gap-1.5"
                          >
                            <span>+{u.phone_number}</span>
                            <span className="text-[10px]">↗</span>
                          </a>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                              u.role === 'admin'
                                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                                : 'bg-slate-800 border-slate-700 text-slate-300'
                            }`}
                          >
                            {u.role === 'admin' ? '👑 Admin' : '👤 User'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          {!isSelf && (
                            <>
                              <button
                                onClick={() => toggleRole(u)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 transition"
                              >
                                {u.role === 'admin' ? 'Set as User' : 'Set as Admin'}
                              </button>
                              <button
                                onClick={() => deleteUser(u.id, u.username)}
                                className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-xs text-rose-300 transition"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
