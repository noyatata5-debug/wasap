'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';

export default function ThreadAdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Calendar Navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('all');

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [threadCategory, setThreadCategory] = useState('yap');
  const [platform, setPlatform] = useState('twitter');
  const [scheduledTime, setScheduledTime] = useState('19:00');
  const [threadStatus, setThreadStatus] = useState('scheduled');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const categories = [
    { key: 'yap', label: 'Random Yap / Curhat', icon: '🗣️', color: 'purple' },
    { key: 'tech', label: 'Tech & AI / Coding', icon: '💻', color: 'blue' },
    { key: 'crypto', label: 'Crypto & Web3 / Alpha', icon: '🚀', color: 'emerald' },
    { key: 'story', label: 'Storytelling & Pengalaman', icon: '📖', color: 'amber' },
    { key: 'business', label: 'Business & Finance', icon: '💼', color: 'rose' },
  ];

  const platforms = [
    { key: 'twitter', label: 'Twitter / X', icon: '𝕏' },
    { key: 'threads', label: 'Threads App', icon: '🧵' },
    { key: 'whatsapp', label: 'WhatsApp Broadcast / Status', icon: '💬' },
  ];

  const categoryColorMap = {
    purple: { bg: 'bg-purple-950/60', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-400' },
    blue: { bg: 'bg-sky-950/60', border: 'border-sky-500/40', text: 'text-sky-300', dot: 'bg-sky-400' },
    emerald: { bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
    amber: { bg: 'bg-amber-950/60', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400' },
    rose: { bg: 'bg-rose-950/60', border: 'border-rose-500/40', text: 'text-rose-300', dot: 'bg-rose-400' },
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
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
    if (user && user.phone_number) {
      fetchThreads();

      const channel = supabase
        .channel(`threads-realtime-${user.phone_number}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, () => fetchThreads(false))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  async function fetchThreads(showLoader = true) {
    if (!user) return;
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
        .order('scheduled_date', { ascending: true });

      if (error) {
        console.warn('Tabel threads error / belum dibuat:', error.message);
        return;
      }
      if (data) setThreads(data);
    } catch (err) {
      console.error('Fetch threads error:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function handleSaveThread(e) {
    e.preventDefault();
    if (!threadTitle.trim() || !threadContent.trim() || !user) return;

    setSubmitting(true);
    const payload = {
      phone_number: user.phone_number,
      title: threadTitle.trim(),
      content: threadContent.trim(),
      yap_category: threadCategory,
      platform: platform,
      scheduled_date: selectedDate,
      scheduled_time: scheduledTime ? `${scheduledTime}:00` : '19:00:00',
      status: threadStatus,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('threads').update(payload).eq('id', editingId);
        if (error) throw error;
        setThreads((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...payload } : t)));
        showToast('Jadwal Yap Thread diperbarui! ✨');
      } else {
        const { data, error } = await supabase.from('threads').insert([payload]).select().single();
        if (error) throw error;
        if (data) setThreads((prev) => [...prev, data]);
        showToast('Yap Thread dijadwalkan ke Kalender! 🧵🚀');
      }

      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      showToast('Gagal menyimpan jadwal Yap Thread', 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleThreadStatus(threadItem) {
    const nextStatus = threadItem.status === 'posted' ? 'scheduled' : 'posted';
    try {
      setThreads((prev) => prev.map((t) => (t.id === threadItem.id ? { ...t, status: nextStatus } : t)));
      const { error } = await supabase.from('threads').update({ status: nextStatus }).eq('id', threadItem.id);
      if (error) throw error;
      showToast(`Status Thread diubah jadi: ${nextStatus.toUpperCase()}`);
    } catch (err) {
      showToast('Gagal update status thread', 'error');
      fetchThreads(false);
    }
  }

  async function deleteThread(id) {
    try {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      const { error } = await supabase.from('threads').delete().eq('id', id);
      if (error) throw error;
      showToast('Jadwal Yap Thread dihapus');
    } catch (err) {
      showToast('Gagal menghapus thread', 'error');
      fetchThreads(false);
    }
  }

  function openAddModal(dateStr = today) {
    resetForm();
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  }

  function openEditModal(threadItem) {
    setEditingId(threadItem.id);
    setSelectedDate(threadItem.scheduled_date);
    setThreadTitle(threadItem.title);
    setThreadContent(threadItem.content);
    setThreadCategory(threadItem.yap_category || 'yap');
    setPlatform(threadItem.platform || 'twitter');
    setScheduledTime(threadItem.scheduled_time ? threadItem.scheduled_time.slice(0, 5) : '19:00');
    setThreadStatus(threadItem.status || 'scheduled');
    setIsModalOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setThreadTitle('');
    setThreadContent('');
    setThreadCategory('yap');
    setPlatform('twitter');
    setScheduledTime('19:00');
    setThreadStatus('scheduled');
  }

  // --- CALENDAR GENERATOR LOGIC ---
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const monthNamesIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const adjustedFirstDay = (firstDayIndex + 6) % 7;

    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dayNumber: dayNum, dateString: dateStr, isCurrentMonth: false });
    }

    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateString: dateStr, isCurrentMonth: true });
    }

    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateString: dateStr, isCurrentMonth: false });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Group threads by date
  const threadsByDate = useMemo(() => {
    const map = {};
    threads.forEach((t) => {
      if (!map[t.scheduled_date]) map[t.scheduled_date] = [];
      if (filterCategory === 'all' || t.yap_category === filterCategory) {
        map[t.scheduled_date].push(t);
      }
    });
    return map;
  }, [threads, filterCategory]);

  const selectedDateThreads = useMemo(() => {
    return threads.filter((t) => t.scheduled_date === selectedDate);
  }, [threads, selectedDate]);

  const postedCount = useMemo(() => threads.filter((t) => t.status === 'posted').length, [threads]);
  const scheduledCount = useMemo(() => threads.filter((t) => t.status === 'scheduled').length, [threads]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat Yap Planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-purple-500 selection:text-white pb-24">
      {/* Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed bottom-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Navbar />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-purple-500/40 text-purple-300'
          }`}
        >
          <span className="text-base">{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* Header Section */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center text-white text-xl font-bold shadow-glow-violet">
                🧵
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Thread Admin & Yap Planner
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Kalender dinding jadwal posting Thread/Yap terintegrasi script auto-yap bot Hermes
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => openAddModal(today)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition shadow-glow-violet active:scale-95 flex items-center gap-2"
            >
              <span>+ Jadwalkan Yap Thread</span>
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
          <div className="glass-panel rounded-2xl p-5 border border-purple-500/20 space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400">Total Thread Tersimpan</span>
            <p className="text-2xl sm:text-3xl font-black text-white font-mono">{threads.length}</p>
            <p className="text-xs text-slate-500">Seluruh arsip & agenda Yap</p>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-indigo-500/20 space-y-1">
            <span className="text-xs uppercase font-bold text-indigo-300">Menunggu Dipost (Scheduled)</span>
            <p className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">{scheduledCount}</p>
            <p className="text-xs text-slate-500">Siap dieksekusi Hermes Bot</p>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-emerald-500/20 space-y-1">
            <span className="text-xs uppercase font-bold text-emerald-400">Sudah Terbit (Posted)</span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">{postedCount}</p>
            <p className="text-xs text-slate-500">Telah sukses dipublikasikan</p>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-pink-500/20 space-y-1">
            <span className="text-xs uppercase font-bold text-pink-300">Hermes Yap Bot Sync</span>
            <p className="text-sm font-bold text-pink-400 flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" /> Aktif & Terhubung
            </p>
            <p className="text-xs text-slate-500 mt-1">Auto schedule via WhatsApp</p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ============= BIG DARK AESTHETIC YAP WALL CALENDAR ====================== */}
        {/* ========================================================================= */}
        <section className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 shadow-glass border border-slate-800 relative overflow-hidden">
          {/* Calendar Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 text-lg font-bold">
                🗓️
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white capitalize">
                  {monthNamesIndo[currentMonth]} {currentYear}
                </h2>
                <p className="text-xs text-slate-400">
                  Klik tanggal untuk melihat hook thread atau membuat postingan baru
                </p>
              </div>
            </div>

            {/* Filters & Month Nav */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Category Filters */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                    filterCategory === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Semua
                </button>
                {categories.map((c) => (
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
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                  title="Bulan Sebelumnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setCurrentDate(new Date());
                    setSelectedDate(today);
                  }}
                  className="px-3 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/30 text-purple-300 text-xs font-semibold transition"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                  title="Bulan Berikutnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/60 shadow-2xl">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-900/90 border-b border-slate-800 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-3">
              {daysOfWeek.map((day, idx) => (
                <div key={day} className={idx >= 5 ? 'text-pink-400/90' : 'text-slate-300'}>
                  {day}
                </div>
              ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-950/40">
              {calendarDays.map((item, index) => {
                const isToday = item.dateString === today;
                const isSelected = item.dateString === selectedDate;
                const dayThreads = threadsByDate[item.dateString] || [];

                return (
                  <div
                    key={`${item.dateString}-${index}`}
                    onClick={() => {
                      setSelectedDate(item.dateString);
                      setIsModalOpen(true);
                    }}
                    className={`min-h-[130px] sm:min-h-[150px] p-2 sm:p-2.5 transition-all flex flex-col justify-between cursor-pointer group relative ${
                      !item.isCurrentMonth
                        ? 'bg-slate-950/80 text-slate-600 opacity-35 hover:opacity-80'
                        : isToday
                        ? 'bg-gradient-to-b from-purple-950/40 to-slate-900/60 border-purple-500/50 shadow-inner'
                        : 'hover:bg-slate-900/70 text-slate-300'
                    } ${isSelected ? 'ring-2 ring-inset ring-purple-400/80' : ''}`}
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all ${
                          isToday
                            ? 'bg-gradient-to-tr from-purple-600 to-pink-500 text-white font-black shadow-glow-violet scale-105'
                            : 'group-hover:bg-slate-800 group-hover:text-white text-slate-300'
                        }`}
                      >
                        {item.dayNumber}
                      </span>

                      {dayThreads.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {dayThreads.length} Yap
                        </span>
                      )}
                    </div>

                    {/* Sticky Card Notes in Cell */}
                    <div className="space-y-1.5 my-1.5 overflow-hidden flex-1 max-h-[90px]">
                      {dayThreads.slice(0, 3).map((t) => {
                        const catObj = categories.find((c) => c.key === t.yap_category) || categories[0];
                        const style = categoryColorMap[catObj.color] || categoryColorMap.purple;
                        const isPosted = t.status === 'posted';

                        return (
                          <div
                            key={t.id}
                            title={`${t.title} (${t.scheduled_time?.slice(0, 5) || '19:00'})`}
                            className={`p-1.5 rounded-lg border text-[10px] sm:text-[11px] font-medium transition-all shadow-sm ${
                              isPosted
                                ? 'bg-slate-900/60 border-slate-800 text-slate-500 line-through opacity-60'
                                : `${style.bg} ${style.border} ${style.text} hover:scale-102`
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-bold">{catObj.icon} {t.title}</span>
                              <span className="font-mono text-[9px] opacity-80 shrink-0">
                                {t.scheduled_time?.slice(0, 5)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {dayThreads.length > 3 && (
                        <span className="text-[10px] text-purple-400 font-bold block pl-1">
                          +{dayThreads.length - 3} yap lainnya...
                        </span>
                      )}
                    </div>

                    {/* Hover Prompt */}
                    <div className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between pt-1 border-t border-slate-800/40">
                      <span>Detail Yap</span>
                      <span className="text-purple-400 font-semibold">+ Jadwal 🧵</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ============= MODAL DETAIL & FORM JADWAL YAP THREAD ===================== */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 sm:p-8 space-y-6 border border-purple-500/30 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🧵</span>
                  <h3 className="text-xl font-bold text-white">
                    Jadwal Yap Tanggal:{' '}
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
                  Kelola draft naskah thread dan jadwal publikasi bot Hermes
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* List of Threads on this Date */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Daftar Yap / Thread di Tanggal Ini ({selectedDateThreads.length})
              </h4>

              {selectedDateThreads.length === 0 ? (
                <div className="py-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-xs text-slate-500 space-y-1">
                  <p>Belum ada jadwal Yap / Thread di tanggal ini.</p>
                  <p className="text-slate-600">Gunakan form di bawah untuk membuat postingan baru.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {selectedDateThreads.map((t) => {
                    const catObj = categories.find((c) => c.key === t.yap_category) || categories[0];
                    const style = categoryColorMap[catObj.color] || categoryColorMap.purple;
                    const isPosted = t.status === 'posted';

                    return (
                      <div
                        key={t.id}
                        className={`p-4 rounded-2xl border space-y-2 transition ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs">{catObj.icon}</span>
                              <span className="text-xs font-bold text-white">{t.title}</span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/40 text-amber-300 border border-white/10">
                                ⏰ {t.scheduled_time?.slice(0, 5) || '19:00'} WIB
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isPosted
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              }`}>
                                {isPosted ? '✅ POSTED' : '⏳ SCHEDULED'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
                              {t.content}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => toggleThreadStatus(t)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                isPosted
                                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                              }`}
                            >
                              {isPosted ? 'Revert' : 'Mark Done'}
                            </button>
                            <button
                              onClick={() => openEditModal(t)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => deleteThread(t.id)}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 transition"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Form Input Yap Thread */}
            <form onSubmit={handleSaveThread} className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>{editingId ? '✏️ Edit Jadwal Yap Thread' : '+ Tulis & Jadwalkan Yap Thread Baru'}</span>
                {editingId && (
                  <button type="button" onClick={resetForm} className="text-[10px] text-rose-400 hover:underline">
                    Batal Edit
                  </button>
                )}
              </h4>

              {/* Hook / Title */}
              <input
                type="text"
                placeholder="Hook / Judul Topik Thread (contoh: 5 AI Tools yang Bikin Coding 10x Lebih Cepat)"
                value={threadTitle}
                onChange={(e) => setThreadTitle(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm font-semibold placeholder:text-slate-500 focus:border-purple-500"
                required
              />

              {/* Content / Script Yap */}
              <textarea
                rows={4}
                placeholder="Tulis naskah lengkap Thread / Yap di sini... (Hermes Yap Bot akan mengambil script ini saat jam tayang)"
                value={threadContent}
                onChange={(e) => setThreadContent(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-xs placeholder:text-slate-500 focus:border-purple-500 resize-none font-mono"
                required
              />

              {/* Category, Platform, Time Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Kategori Yap</label>
                  <select
                    value={threadCategory}
                    onChange={(e) => setThreadCategory(e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs bg-slate-900 text-slate-200"
                  >
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs bg-slate-900 text-slate-200"
                  >
                    {platforms.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.icon} {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">Jam Posting (WIB)</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-xl text-xs font-mono text-slate-200 bg-slate-900"
                    required
                  />
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
                  disabled={submitting || !threadTitle.trim() || !threadContent.trim()}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold transition shadow-glow-violet"
                >
                  {submitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Jadwalkan Yap'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
