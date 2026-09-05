'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [usersList, setUsersList] = useState([]);
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [totalExpensesCount, setTotalExpensesCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // --- CALENDAR & NOTES STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [adminNotes, setAdminNotes] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('reminder');
  const [noteColor, setNoteColor] = useState('purple');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = [
    { key: 'reminder', label: 'Pengingat', icon: '🔔', color: 'purple' },
    { key: 'deadline', label: 'Tenggat Waktu', icon: '🚨', color: 'rose' },
    { key: 'financial', label: 'Finansial / Budget', icon: '💰', color: 'emerald' },
    { key: 'meeting', label: 'Rapat & Diskusi', icon: '🤝', color: 'blue' },
    { key: 'general', label: 'Catatan Umum', icon: '📝', color: 'amber' },
  ];

  const colorMap = {
    purple: { bg: 'bg-purple-950/60', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-400' },
    rose: { bg: 'bg-rose-950/60', border: 'border-rose-500/40', text: 'text-rose-300', dot: 'bg-rose-400' },
    emerald: { bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    blue: { bg: 'bg-blue-950/60', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-400' },
    amber: { bg: 'bg-amber-950/60', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400' },
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // Auth Protection Guard
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      }
    }
  }, [user, authLoading, router]);

  // Load Admin Data & Calendar Notes
  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchAdminData();
      fetchAdminNotes();
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

      if (uErr) console.error('Gagal mengambil data user:', uErr);
      if (tErr) console.error('Gagal menghitung task:', tErr);
      if (eErr) console.error('Gagal menghitung expense:', eErr);

      if (uData) setUsersList(uData);
      if (tCount !== null) setTotalTasksCount(tCount);
      if (eCount !== null) setTotalExpensesCount(eCount);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setDataLoading(false);
    }
  }

  async function fetchAdminNotes() {
    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.warn('Tabel admin_notes belum dibuat di Supabase atau terjadi error:', error.message);
        return;
      }
      if (data) setAdminNotes(data);
    } catch (err) {
      console.error('Error fetching admin notes:', err);
    }
  }

  async function addNote(e) {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    setSubmittingNote(true);
    const newNote = {
      note_date: selectedDate,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      category: noteCategory,
      color: noteColor,
      created_by: user.username,
    };

    try {
      const { data, error } = await supabase
        .from('admin_notes')
        .insert([newNote])
        .select()
        .single();

      if (error) {
        // Fallback simpan local state jika tabel belum dieksekusi di Supabase
        const fallbackNote = { ...newNote, id: Date.now() };
        setAdminNotes(prev => [...prev, fallbackNote]);
        showToast('Catatan disimpan (Jalankan schema.sql di Supabase untuk realtime permanen)', 'warning');
      } else if (data) {
        setAdminNotes(prev => [...prev, data]);
        showToast('Catatan kalender berhasil ditambahkan! 📌');
      }

      setNoteTitle('');
      setNoteContent('');
    } catch (err) {
      showToast('Gagal menambahkan catatan', 'error');
      console.error(err);
    } finally {
      setSubmittingNote(false);
    }
  }

  async function deleteNote(id) {
    try {
      setAdminNotes(prev => prev.filter(n => n.id !== id));
      const { error } = await supabase.from('admin_notes').delete().eq('id', id);
      if (error) {
        console.warn('Hapus di database gagal, dihapus dari tampilan.');
      }
      showToast('Catatan berhasil dihapus');
    } catch (err) {
      showToast('Gagal menghapus catatan', 'error');
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

  // --- CALENDAR GENERATOR LOGIC ---
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNamesIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    // Convert so Monday is 0, Sunday is 6
    const adjustedFirstDay = (firstDayIndex + 6) % 7;

    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Previous month leading days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dayNum,
        dateString: dateStr,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: true,
      });
    }

    // Trailing next month days to complete 35 or 42 grid cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNumber: i,
        dateString: dateStr,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Map notes by date string
  const notesByDate = useMemo(() => {
    const map = {};
    adminNotes.forEach(note => {
      if (!map[note.note_date]) map[note.note_date] = [];
      if (filterCategory === 'all' || note.category === filterCategory) {
        map[note.note_date].push(note);
      }
    });
    return map;
  }, [adminNotes, filterCategory]);

  const selectedDateNotes = useMemo(() => {
    return adminNotes.filter(n => n.note_date === selectedDate);
  }, [adminNotes, selectedDate]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      u =>
        u.username.toLowerCase().includes(q) ||
        (u.phone_number && u.phone_number.includes(q))
    );
  }, [usersList, searchQuery]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  const openDateModal = (dateStr) => {
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

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
    <div className="relative min-h-screen bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-purple-500 selection:text-white pb-20">
      {/* Dynamic Background Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed top-1/3 right-10 w-[450px] h-[450px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-1/3 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 border-amber-500/40 text-amber-200'
              : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : toast.type === 'warning' ? '💡' : '✅'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* --- HEADER --- */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-purple-500/10 via-indigo-500/5 to-transparent pointer-events-none" />

          <div className="space-y-1.5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center shadow-glow-violet text-white text-xl font-bold">
                👑
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Admin Control & Agenda Hub
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Kalender jadwal terpadu, catatan admin, dan manajemen seluruh pengguna
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap relative z-10">
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-200 transition active:scale-95"
            >
              <span>← Kembali ke Workspace</span>
            </Link>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-semibold transition active:scale-95"
            >
              Logout
            </button>
          </div>
        </header>

        {/* --- STATS OVERVIEW --- */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1 relative overflow-hidden">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Pengguna</span>
            <p className="text-2xl sm:text-3xl font-black text-white">{usersList.length}</p>
            <p className="text-xs text-slate-500">Terdaftar & tersinkronisasi</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1 relative overflow-hidden">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Tugas Sistem</span>
            <p className="text-2xl sm:text-3xl font-black text-blue-400">{totalTasksCount}</p>
            <p className="text-xs text-slate-500">Seluruh tugas tercatat</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1 relative overflow-hidden">
            <span className="text-xs uppercase font-semibold text-slate-400">Total Transaksi</span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400">{totalExpensesCount}</p>
            <p className="text-xs text-slate-500">Catatan pengeluaran masuk</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/5 space-y-1 relative overflow-hidden">
            <span className="text-xs uppercase font-semibold text-slate-400">Agenda & Catatan</span>
            <p className="text-2xl sm:text-3xl font-black text-purple-400">{adminNotes.length}</p>
            <p className="text-xs text-slate-500">Event pada kalender admin</p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* ================= BIG DARK CALENDAR SECTION ================= */}
        {/* ============================================================== */}
        <section className="glass-panel rounded-3xl p-5 sm:p-8 space-y-6 shadow-glass border border-slate-800">
          {/* Calendar Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 text-lg font-bold">
                🗓️
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white capitalize flex items-center gap-2">
                  <span>{monthNamesIndo[currentMonth]} {currentYear}</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Klik tanggal untuk melihat atau menambahkan note / pengingat / deadline
                </p>
              </div>
            </div>

            {/* Navigation & Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                    filterCategory === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua
                </button>
                {categories.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setFilterCategory(c.key)}
                    className={`px-2 py-1.5 rounded-lg font-medium transition flex items-center gap-1 ${
                      filterCategory === c.key ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={c.label}
                  >
                    <span>{c.icon}</span>
                  </button>
                ))}
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={prevMonth}
                  title="Bulan Sebelumnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/30 text-purple-300 text-xs font-semibold transition"
                >
                  Hari Ini
                </button>
                <button
                  onClick={nextMonth}
                  title="Bulan Berikutnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => openDateModal(todayStr)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-glow-violet flex items-center gap-1.5"
              >
                <span>+ Buat Catatan</span>
              </button>
            </div>
          </div>

          {/* Large Calendar Grid */}
          <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/50">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-900/90 border-b border-slate-800 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-3">
              {daysOfWeek.map((day, idx) => (
                <div key={day} className={idx >= 5 ? 'text-rose-400/80' : ''}>
                  {day}
                </div>
              ))}
            </div>

            {/* Date Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-950/40">
              {calendarDays.map((item, index) => {
                const isToday = item.dateString === todayStr;
                const isSelected = item.dateString === selectedDate;
                const dayNotes = notesByDate[item.dateString] || [];

                return (
                  <div
                    key={`${item.dateString}-${index}`}
                    onClick={() => openDateModal(item.dateString)}
                    className={`min-h-[110px] sm:min-h-[130px] p-2 sm:p-2.5 transition-all flex flex-col justify-between cursor-pointer group relative ${
                      !item.isCurrentMonth
                        ? 'bg-slate-950/70 text-slate-600 opacity-40 hover:opacity-80'
                        : isToday
                        ? 'bg-purple-950/20 border-purple-500/50 shadow-inner'
                        : 'hover:bg-slate-900/60 text-slate-300'
                    } ${isSelected ? 'ring-1 ring-inset ring-purple-500/80' : ''}`}
                  >
                    {/* Top Row in Cell: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all ${
                          isToday
                            ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-glow-violet scale-105'
                            : 'group-hover:bg-slate-800 group-hover:text-white'
                        }`}
                      >
                        {item.dayNumber}
                      </span>

                      {dayNotes.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {dayNotes.length}
                        </span>
                      )}
                    </div>

                    {/* Middle: Notes Badges List inside Date Cell */}
                    <div className="space-y-1.5 my-1.5 overflow-hidden flex-1 max-h-[72px]">
                      {dayNotes.slice(0, 3).map((note) => {
                        const style = colorMap[note.color] || colorMap.purple;
                        return (
                          <div
                            key={note.id}
                            title={`${note.title}${note.content ? ` - ${note.content}` : ''}`}
                            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-medium border truncate transition ${style.bg} ${style.border} ${style.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} flex-shrink-0`} />
                            <span className="truncate">{note.title}</span>
                          </div>
                        );
                      })}
                      {dayNotes.length > 3 && (
                        <span className="text-[10px] text-slate-500 font-semibold block pl-1">
                          +{dayNotes.length - 3} lainnya...
                        </span>
                      )}
                    </div>

                    {/* Bottom: Hover Quick Prompt */}
                    <div className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end">
                      <span className="text-purple-400 font-medium">+ Note</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* --- USERS MANAGEMENT TABLE --- */}
        <section className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👥 Manajemen Pengguna & Nomor WhatsApp</span>
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

      {/* ============================================================== */}
      {/* ================= DATE DETAIL & ADD NOTE MODAL ================ */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 border border-purple-500/30 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <h3 className="text-xl font-bold text-white">
                    Catatan Tanggal:{' '}
                    <span className="text-purple-400">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Kelola jadwal, agenda penting, pengingat, dan catatan khusus admin
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Existing Notes on this date */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Daftar Catatan ({selectedDateNotes.length})</span>
              </h4>

              {selectedDateNotes.length === 0 ? (
                <div className="py-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-xs text-slate-500 space-y-1">
                  <p>Belum ada catatan atau agenda di tanggal ini.</p>
                  <p className="text-slate-600">Gunakan form di bawah untuk membuat catatan baru.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedDateNotes.map(n => {
                    const style = colorMap[n.color] || colorMap.purple;
                    const catObj = categories.find(c => c.key === n.category) || categories[0];
                    return (
                      <div
                        key={n.id}
                        className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition ${style.bg} ${style.border}`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs">{catObj.icon}</span>
                            <span className="text-xs font-semibold px-2 py-0.2 rounded-md bg-black/30 border border-white/10 text-slate-200">
                              {catObj.label}
                            </span>
                            <span className={`text-sm font-bold ${style.text}`}>{n.title}</span>
                          </div>
                          {n.content && (
                            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-6">
                              {n.content}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 pl-6 flex items-center gap-2">
                            <span>Oleh @{n.created_by || 'admin'}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => deleteNote(n.id)}
                          title="Hapus Catatan"
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add New Note Form */}
            <form onSubmit={addNote} className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                + Tambah Catatan / Agenda Baru
              </h4>

              {/* Title */}
              <input
                type="text"
                placeholder="Judul catatan / agenda (contoh: Deadline Rekap Laporan Bulanan)"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-500 focus:border-purple-500"
                required
              />

              {/* Content Details */}
              <textarea
                rows={2}
                placeholder="Detail / deskripsi tambahan (opsional)..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="glass-input w-full px-4 py-2 rounded-xl text-xs placeholder:text-slate-500 focus:border-purple-500 resize-none"
              />

              {/* Category & Color Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Kategori Agenda</label>
                  <select
                    value={noteCategory}
                    onChange={(e) => {
                      setNoteCategory(e.target.value);
                      const matched = categories.find(c => c.key === e.target.value);
                      if (matched) setNoteColor(matched.color);
                    }}
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs bg-slate-900 text-slate-200"
                  >
                    {categories.map(c => (
                      <option key={c.key} value={c.key} className="bg-slate-900 text-slate-200">
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color highlight selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Warna Tag</label>
                  <div className="flex items-center gap-2 pt-1">
                    {['purple', 'rose', 'emerald', 'blue', 'amber'].map(colorKey => (
                      <button
                        key={colorKey}
                        type="button"
                        onClick={() => setNoteColor(colorKey)}
                        className={`w-7 h-7 rounded-xl border-2 transition-all flex items-center justify-center ${
                          noteColor === colorKey ? 'scale-110 ring-2 ring-white/50 border-white' : 'opacity-70 border-transparent'
                        } ${colorMap[colorKey].dot}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !noteTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition shadow-glow-violet"
                >
                  {submittingNote ? 'Menyimpan...' : 'Simpan ke Kalender'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
