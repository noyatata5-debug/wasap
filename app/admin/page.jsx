'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [resetModalUser, setResetModalUser] = useState(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [submittingReset, setSubmittingReset] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'admin') {
        router.push('/');
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  async function fetchUsers() {
    setDataLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
      if (data) setUsersList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }

  const togglePasswordVisibility = (userId) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const copyPassword = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Password disalin ke clipboard! 📋');
  };

  async function toggleRole(targetUser) {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      await supabase.from('users').update({ role: nextRole }).eq('id', targetUser.id);
      setUsersList(prev => prev.map(u => (u.id === targetUser.id ? { ...u, role: nextRole } : u)));
      showToast(`Role ${targetUser.username} diubah jadi ${nextRole.toUpperCase()}`);
    } catch (err) {
      showToast('Gagal mengubah role', 'error');
    }
  }

  async function deleteUser(id, username) {
    if (!confirm(`Hapus akun @${username}?`)) return;
    try {
      await supabase.from('users').delete().eq('id', id);
      setUsersList(prev => prev.filter(u => u.id !== id));
      showToast(`User @${username} dihapus`);
    } catch (err) {
      showToast('Gagal menghapus user', 'error');
    }
  }

  async function handleAdminResetPassword(e) {
    e.preventDefault();
    if (!resetModalUser || !adminNewPassword || adminNewPassword.length < 4) {
      showToast('Password baru minimal 4 karakter!', 'error');
      return;
    }

    setSubmittingReset(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(adminNewPassword + '_wasap_salt_2026');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase
        .from('users')
        .update({
          password_hash: newHash,
          password_raw: adminNewPassword,
        })
        .eq('id', resetModalUser.id);

      if (error) throw error;

      setUsersList(prev =>
        prev.map(u => (u.id === resetModalUser.id ? { ...u, password_raw: adminNewPassword, password_hash: newHash } : u))
      );
      showToast(`Password @${resetModalUser.username} berhasil di-reset!`);
      setResetModalUser(null);
      setAdminNewPassword('');
    } catch (err) {
      showToast('Gagal me-reset password', 'error');
    } finally {
      setSubmittingReset(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      u => u.username.toLowerCase().includes(q) || (u.phone_number && u.phone_number.includes(q))
    );
  }, [usersList, searchQuery]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center text-[#616c8a]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat sesi Admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text-main)] pb-24 transition-colors duration-200">
      <Navbar />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-lg border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-[#13426f] dark:bg-[#2e96ff] text-white border-transparent'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="relief-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#13426f] dark:text-[#38bdf8] tracking-tight">
                User & Access Control
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#bde1f9] dark:bg-slate-800 text-[#13426f] dark:text-sky-300">
                {usersList.length} User Terdaftar
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#616c8a] dark:text-slate-400">
              Kelola role, intip password member, dan kontrol nomor WhatsApp
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari username / no WA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="relief-input w-full px-4 py-2 rounded-full text-xs font-medium"
            />
          </div>
        </div>

        <div className="relief-card p-6 sm:p-7 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[#e7e5dc] dark:border-slate-800">
            <table className="w-full text-left text-xs text-[var(--color-text-main)]">
              <thead className="bg-[#f9f7f0] dark:bg-slate-800/80 text-[11px] font-bold text-[#616c8a] dark:text-slate-400 border-b border-[#e7e5dc] dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">👁️ Intip Password</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5dc] dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user.id;
                  const isRevealed = revealedPasswords[u.id];
                  const rawPass = u.password_raw || 'Tidak tercatat (Hash lama)';

                  return (
                    <tr key={u.id} className="hover:bg-[#f9f7f0] dark:hover:bg-slate-800/50 transition">
                      <td className="py-3 px-4 font-bold text-[#13426f] dark:text-slate-200">
                        @{u.username} {isSelf && '(Anda)'}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-[#2e96ff]">
                        <a
                          href={`https://wa.me/${u.phone_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          +{u.phone_number} ↗
                        </a>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            u.role === 'admin'
                              ? 'bg-[#bde1f9] dark:bg-slate-800 text-[#13426f] dark:text-sky-300'
                              : 'bg-[#f1ede1] dark:bg-slate-800 text-[#616c8a] dark:text-slate-300'
                          }`}
                        >
                          {u.role === 'admin' ? '👑 Admin' : '👤 Member'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#13426f] dark:text-[#38bdf8] bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-[#e7e5dc] dark:border-slate-700 min-w-[90px] inline-block text-center">
                            {isRevealed ? rawPass : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-xs hover:bg-[#f1ede1] dark:hover:bg-slate-700 rounded-md transition"
                            title={isRevealed ? 'Sembunyikan' : 'Intip Password'}
                          >
                            {isRevealed ? '🙈' : '👁️'}
                          </button>
                          {isRevealed && u.password_raw && (
                            <button
                              onClick={() => copyPassword(u.password_raw)}
                              className="p-1 text-xs hover:bg-[#f1ede1] dark:hover:bg-slate-700 rounded-md transition text-[#2e96ff] font-bold"
                              title="Salin Password"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => {
                            setResetModalUser(u);
                            setAdminNewPassword('');
                          }}
                          className="px-2.5 py-1 rounded-full bg-[#f1ede1] dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-[#d0d5dd] dark:border-slate-700 font-bold text-[11px] text-[#13426f] dark:text-slate-200 transition"
                          title="Ganti password member ini"
                        >
                          🔑 Reset Pass
                        </button>

                        {!isSelf && (
                          <>
                            <button
                              onClick={() => toggleRole(u)}
                              className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 hover:bg-[#f1ede1] dark:hover:bg-slate-700 border border-[#d0d5dd] dark:border-slate-700 font-bold text-[11px] text-[#616c8a] dark:text-slate-300 transition"
                            >
                              {u.role === 'admin' ? 'Set as User' : 'Set as Admin'}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id, u.username)}
                              className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-[11px] border border-rose-200 dark:border-rose-800 transition"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Admin Reset Password Member */}
      {resetModalUser && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relief-card bg-white dark:bg-slate-900 border border-[#e7e5dc] dark:border-slate-700 w-full max-w-sm p-6 space-y-4 shadow-2xl relative rounded-3xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#e7e5dc] dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-[#13426f] dark:text-[#38bdf8]">Reset Password Member</h3>
                <p className="text-xs text-[#616c8a] dark:text-slate-400">Untuk user: <strong>@{resetModalUser.username}</strong></p>
              </div>
              <button
                onClick={() => setResetModalUser(null)}
                className="w-7 h-7 rounded-full bg-[#f1ede1] dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[#616c8a] dark:text-slate-300 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#13426f] dark:text-slate-300">Password Baru Member</label>
                <input
                  type="text"
                  placeholder="Contoh: 123456"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  className="relief-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingReset || !adminNewPassword.trim()}
                className="w-full py-2.5 relief-btn-pop text-xs font-bold disabled:opacity-50 mt-2"
              >
                {submittingReset ? 'Menyimpan...' : 'Simpan & Terapkan Password'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
