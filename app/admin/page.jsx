'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      u => u.username.toLowerCase().includes(q) || (u.phone_number && u.phone_number.includes(q))
    );
  }, [usersList, searchQuery]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#f9f7f0] flex items-center justify-center text-[#616c8a]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat sesi Admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333] pb-24">
      <Navbar />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-lg bg-[#13426f] text-white text-xs font-bold">
          <span>✅</span>
          <span>{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="relief-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#13426f] tracking-tight">
                User & Access Control
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#bde1f9] text-[#13426f]">
                {usersList.length} User Terdaftar
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#616c8a]">
              Kelola role dan nomor WhatsApp seluruh pengguna
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

        {/* Table */}
        <div className="relief-card p-6 sm:p-7 space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[#e7e5dc]">
            <table className="w-full text-left text-xs text-[#333333]">
              <thead className="bg-[#f9f7f0] text-[11px] font-bold text-[#616c8a] border-b border-[#e7e5dc]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5dc]">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === user.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#f9f7f0] transition">
                      <td className="py-3 px-4 font-bold text-[#13426f]">
                        @{u.username} {isSelf && '(Anda)'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[#2e96ff]">
                        <a href={`https://wa.me/${u.phone_number}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          +{u.phone_number} ↗
                        </a>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          u.role === 'admin' ? 'bg-[#bde1f9] text-[#13426f]' : 'bg-[#f1ede1] text-[#616c8a]'
                        }`}>
                          {u.role === 'admin' ? '👑 Admin' : '👤 Member'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {!isSelf && (
                          <>
                            <button
                              onClick={() => toggleRole(u)}
                              className="px-3 py-1 rounded-full bg-white hover:bg-[#f1ede1] border border-[#d0d5dd] font-bold text-[11px]"
                            >
                              {u.role === 'admin' ? 'Set as User' : 'Set as Admin'}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id, u.username)}
                              className="px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] border border-rose-200"
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
    </div>
  );
}
