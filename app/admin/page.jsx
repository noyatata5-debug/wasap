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

  // Modal Tambah User Baru
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addUserError, setAddUserError] = useState(null);

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

  async function handleAddUser(e) {
    e.preventDefault();
    setAddUserError(null);

    const cleanUsername = newUsername.trim().toLowerCase();
    let cleanPhone = newPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('08')) {
      cleanPhone = '628' + cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('8')) {
      cleanPhone = '628' + cleanPhone.slice(1);
    }

    if (!cleanUsername || cleanUsername.length < 3) {
      setAddUserError('Username minimal 3 karakter!');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 9) {
      setAddUserError('Nomor WhatsApp minimal 9 digit angka valid!');
      return;
    }
    if (!newPassword || newPassword.length < 4) {
      setAddUserError('Password minimal 4 karakter!');
      return;
    }

    setSubmittingAdd(true);
    try {
      // Check existing username or phone
      const { data: existing, error: checkErr } = await supabase
        .from('users')
        .select('id, username, phone_number')
        .or(`username.eq.${cleanUsername},phone_number.eq.${cleanPhone}`);

      if (checkErr && checkErr.code !== 'PGRST116') {
        console.error(checkErr);
      }

      if (existing && existing.length > 0) {
        const match = existing[0];
        if (match.username.toLowerCase() === cleanUsername) {
          throw new Error(`Username @${cleanUsername} sudah digunakan.`);
        }
        if (match.phone_number === cleanPhone) {
          throw new Error(`Nomor WhatsApp ${cleanPhone} sudah terdaftar.`);
        }
      }

      // Hash password
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword + '_wasap_salt_2026');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert([
          {
            username: cleanUsername,
            phone_number: cleanPhone,
            password_hash: newHash,
            password_raw: newPassword,
            role: newRole,
          },
        ])
        .select()
        .single();

      if (insertErr) throw insertErr;

      setUsersList((prev) => [...prev, created]);
      showToast(`User @${cleanUsername} berhasil didaftarkan! 🎉`);
      setIsAddModalOpen(false);
      setNewUsername('');
      setNewPhone('');
      setNewPassword('');
      setNewRole('user');
    } catch (err) {
      setAddUserError(err.message || 'Gagal menambahkan user baru.');
    } finally {
      setSubmittingAdd(false);
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
      <div className="min-h-screen app-canvas flex items-center justify-center text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat sesi Admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-canvas text-[var(--text-main)] pb-24 transition-colors duration-200">
      <Navbar />

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-lg border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
              : 'bg-[#13426f] dark:bg-[#0284c7] text-white border-transparent'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="app-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-title)] tracking-tight">
                User & Access Control
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full app-badge-highlight">
                {usersList.length} User Terdaftar
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Pendaftaran user dikelola admin, kontrol role, dan akses nomor WhatsApp
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Tombol Tambah User Baru oleh Admin */}
            <button
              type="button"
              onClick={() => {
                setNewUsername('');
                setNewPhone('');
                setNewPassword('');
                setNewRole('user');
                setAddUserError(null);
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center gap-1.5"
            >
              <span>👤+</span>
              <span>Daftarkan User Baru</span>
            </button>

            <div className="w-full sm:w-60">
              <input
                type="text"
                placeholder="Cari username / no WA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-input w-full px-4 py-2 rounded-full text-xs font-medium"
              />
            </div>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="bg-[var(--bg-subtle)] text-[11px] font-bold text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">👁️ Intip Password</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user.id;
                  const isRevealed = revealedPasswords[u.id];
                  const rawPass = u.password_raw || 'Tidak tercatat (Hash lama)';

                  return (
                    <tr key={u.id} className="hover:bg-[var(--bg-subtle)] transition">
                      <td className="py-3 px-4 font-bold text-[var(--text-title)]">
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
                              ? 'app-badge-highlight'
                              : 'app-badge-subtle'
                          }`}
                        >
                          {u.role === 'admin' ? '👑 Admin' : '👤 Member'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[var(--text-title)] bg-[var(--bg-card)] px-2.5 py-1 rounded-lg border border-[var(--border-color)] min-w-[90px] inline-block text-center">
                            {isRevealed ? rawPass : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 text-xs hover:bg-[var(--bg-subtle)] rounded-md transition"
                            title={isRevealed ? 'Sembunyikan' : 'Intip Password'}
                          >
                            {isRevealed ? '🙈' : '👁️'}
                          </button>
                          {isRevealed && u.password_raw && (
                            <button
                              type="button"
                              onClick={() => copyPassword(u.password_raw)}
                              className="p-1 text-xs hover:bg-[var(--bg-subtle)] rounded-md transition text-[#2e96ff] font-bold"
                              title="Salin Password"
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalUser(u);
                            setAdminNewPassword('');
                          }}
                          className="px-2.5 py-1 rounded-full app-card hover:bg-[var(--bg-subtle)] text-[var(--text-main)] font-bold text-[11px] transition"
                          title="Ganti password member ini"
                        >
                          🔑 Reset Pass
                        </button>

                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => toggleRole(u)}
                              className="px-2.5 py-1 rounded-full app-card hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] font-bold text-[11px] transition"
                            >
                              {u.role === 'admin' ? 'Set as User' : 'Set as Admin'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(u.id, u.username)}
                              className="px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-500 font-bold text-[11px] border border-rose-500/30 transition"
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

      {/* Modal Tambah User Baru oleh Admin */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="app-card w-full max-w-md p-6 sm:p-7 space-y-4 shadow-2xl relative border border-[var(--border-color)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="space-y-0.5">
                <h3 className="text-base font-extrabold text-[var(--text-title)] flex items-center gap-2">
                  <span>👤+</span>
                  <span>Daftarkan User Baru</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Buatkan akun dan password untuk member workspace
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            {addUserError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold text-center">
                ⚠️ {addUserError}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-main)]">Username</label>
                <input
                  type="text"
                  placeholder="Contoh: budi_santoso"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="app-input w-full px-4 py-2 rounded-full text-xs font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-main)]">Nomor WhatsApp</label>
                <input
                  type="text"
                  placeholder="Contoh: 628123456789 atau 08123456789"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="app-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                  required
                />
                <span className="text-[10px] text-[var(--text-muted)] pl-2">
                  Otomatis dinormalisasi ke format internasional (628xxx)
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-main)]">Password Awal</label>
                <input
                  type="text"
                  placeholder="Contoh: member123"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="app-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-main)]">Role Akun</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-color)] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setNewRole('user')}
                    className={`py-1.5 rounded-lg transition ${
                      newRole === 'user'
                        ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    👤 Member (User)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRole('admin')}
                    className={`py-1.5 rounded-lg transition ${
                      newRole === 'admin'
                        ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    👑 Admin
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAdd || !newUsername.trim() || !newPhone.trim() || !newPassword.trim()}
                className="w-full py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 mt-2 transition active:scale-95"
              >
                {submittingAdd ? 'Mendaftarkan User...' : 'Simpan & Daftarkan User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Reset Password Member */}
      {resetModalUser && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="app-card w-full max-w-sm p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-base font-extrabold text-[var(--text-title)]">Reset Password Member</h3>
                <p className="text-xs text-[var(--text-muted)]">Untuk user: <strong>@{resetModalUser.username}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setResetModalUser(null)}
                className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminResetPassword} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-main)]">Password Baru Member</label>
                <input
                  type="text"
                  placeholder="Contoh: 123456"
                  value={adminNewPassword}
                  onChange={(e) => setAdminNewPassword(e.target.value)}
                  className="app-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingReset || !adminNewPassword.trim()}
                className="w-full py-2.5 app-btn-pop text-xs font-bold disabled:opacity-50 mt-2"
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
