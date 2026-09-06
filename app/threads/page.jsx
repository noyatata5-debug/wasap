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

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [threadCategory, setThreadCategory] = useState('yap');
  const [platform, setPlatform] = useState('twitter');
  const [scheduledTime, setScheduledTime] = useState('19:00');
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const categories = [
    { key: 'yap', label: 'Random Yap / Curhat', icon: '🗣️' },
    { key: 'tech', label: 'Tech & AI / Coding', icon: '💻' },
    { key: 'crypto', label: 'Crypto & Web3 Alpha', icon: '🚀' },
    { key: 'story', label: 'Storytelling / Pengalaman', icon: '📖' },
  ];

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
      fetchThreads();
    }
  }, [user]);

  async function fetchThreads() {
    try {
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .order('scheduled_date', { ascending: true });

      if (error) console.warn(error.message);
      if (data) setThreads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
      status: 'scheduled',
    };

    try {
      const { data, error } = await supabase.from('threads').insert([payload]).select().single();
      if (error) throw error;
      if (data) setThreads((prev) => [...prev, data]);
      showToast('Yap Thread dijadwalkan ke Kalender! 🧵🚀');
      setThreadTitle('');
      setThreadContent('');
      setIsModalOpen(false);
    } catch (err) {
      showToast('Gagal menyimpan jadwal Yap Thread', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteThread(id) {
    try {
      setThreads((prev) => prev.filter((t) => t.id !== id));
      await supabase.from('threads').delete().eq('id', id);
      showToast('Thread dihapus');
    } catch (err) {
      showToast('Gagal menghapus thread', 'error');
    }
  }

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

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[var(--color-canvas)] flex items-center justify-center text-[#616c8a]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat Yap Planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-text-main)] pb-24 transition-colors duration-200">
      <Navbar />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-lg bg-[#13426f] dark:bg-[#2e96ff] text-white text-xs font-bold">
          <span>✅</span>
          <span>{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        <div className="relief-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#13426f] dark:text-[#38bdf8] tracking-tight">
                Thread Admin & Yap Planner
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#bde1f9] dark:bg-slate-800 text-[#13426f] dark:text-sky-300">
                Admin Exclusive
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#616c8a] dark:text-slate-400">
              Jadwalkan postingan thread & auto-yap Hermes bot
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 relief-btn-pop text-xs font-bold"
          >
            + Jadwalkan Yap Thread
          </button>
        </div>

        <section className="relief-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e7e5dc] dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#bde1f9] dark:bg-slate-800 text-[#13426f] dark:text-[#38bdf8] flex items-center justify-center font-bold text-lg shadow-sm">
                🧵
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#13426f] dark:text-[#38bdf8]">
                  {monthNamesIndo[currentMonth]} {currentYear}
                </h2>
                <p className="text-xs text-[#616c8a] dark:text-slate-400">Klik tanggal untuk menjadwalkan topik Yap</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth - 1, 1))}
                className="p-2 rounded-full bg-white dark:bg-slate-800 hover:bg-[#f1ede1] dark:hover:bg-slate-700 border border-[#d0d5dd] dark:border-slate-700 text-[#616c8a] dark:text-slate-300 text-xs font-bold transition"
              >
                ◀
              </button>
              <button
                onClick={() => {
                  setCurrentDate(new Date());
                  setSelectedDate(today);
                }}
                className="px-4 py-1.5 rounded-full bg-[#f1ede1] dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-[#d0d5dd] dark:border-slate-700 text-xs font-bold text-[#13426f] dark:text-[#38bdf8] transition"
              >
                Hari Ini
              </button>
              <button
                onClick={() => setCurrentDate(new Date(currentYear, currentMonth + 1, 1))}
                className="p-2 rounded-full bg-white dark:bg-slate-800 hover:bg-[#f1ede1] dark:hover:bg-slate-700 border border-[#d0d5dd] dark:border-slate-700 text-[#616c8a] dark:text-slate-300 text-xs font-bold transition"
              >
                ▶
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e7e5dc] dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="grid grid-cols-7 bg-[#f9f7f0] dark:bg-slate-800/80 border-b border-[#e7e5dc] dark:border-slate-800 text-center text-xs font-bold text-[#616c8a] dark:text-slate-400 uppercase py-3">
              {daysOfWeek.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-[#e7e5dc] dark:divide-slate-800">
              {calendarDays.map((item, idx) => {
                const isToday = item.dateString === today;
                const isSelected = item.dateString === selectedDate;
                const dayThreads = threadsByDate[item.dateString] || [];

                return (
                  <div
                    key={`${item.dateString}-${idx}`}
                    onClick={() => {
                      setSelectedDate(item.dateString);
                      setIsModalOpen(true);
                    }}
                    className={`min-h-[120px] p-2 transition flex flex-col justify-between cursor-pointer group ${
                      !item.isCurrentMonth
                        ? 'bg-[#fcfbf7] dark:bg-slate-950/40 text-[#c3cad9] dark:text-slate-700'
                        : isToday
                        ? 'bg-[#bde1f9]/20 dark:bg-sky-950/30'
                        : 'hover:bg-[#f9f7f0] dark:hover:bg-slate-800/50'
                    } ${isSelected ? 'ring-2 ring-inset ring-[#2e96ff]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-[#2e96ff] text-white shadow-sm' : 'text-[#333333] dark:text-slate-300'
                      }`}>
                        {item.dayNumber}
                      </span>
                      {dayThreads.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#13426f] dark:bg-[#2e96ff] text-white">
                          {dayThreads.length} Yap
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1 overflow-hidden flex-1 max-h-[65px]">
                      {dayThreads.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className="text-[10px] px-2 py-0.5 rounded-lg border border-[#bde1f9] dark:border-sky-800 bg-[#bde1f9]/40 dark:bg-sky-900/40 text-[#13426f] dark:text-sky-300 font-bold truncate"
                        >
                          🧵 {t.title}
                        </div>
                      ))}
                    </div>

                    <div className="text-[9px] text-[#2e96ff] font-bold opacity-0 group-hover:opacity-100 transition flex justify-end">
                      + Jadwal Yap
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relief-card bg-white dark:bg-slate-900 border border-[#e7e5dc] dark:border-slate-700 w-full max-w-xl p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto rounded-3xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#e7e5dc] dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-[#13426f] dark:text-[#38bdf8]">
                  Yap Tanggal:{' '}
                  <span className="text-[#2e96ff]">
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#f1ede1] dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-[#616c8a] dark:text-slate-300 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-[#616c8a] dark:text-slate-400">
                Daftar Yap ({selectedDateThreads.length})
              </h4>
              {selectedDateThreads.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#616c8a] dark:text-slate-400 bg-[#f9f7f0] dark:bg-slate-800/40 rounded-2xl border border-dashed border-[#d0d5dd] dark:border-slate-700">
                  Belum ada jadwal Yap di tanggal ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedDateThreads.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-[#e7e5dc] dark:border-slate-700 space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#13426f] dark:text-[#38bdf8]">🧵 {t.title}</span>
                        <button
                          onClick={() => deleteThread(t.id)}
                          className="text-xs text-[#616c8a] dark:text-slate-400 hover:text-rose-600 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs text-[#616c8a] dark:text-slate-400 line-clamp-2 leading-relaxed">{t.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSaveThread} className="space-y-3 pt-3 border-t border-[#e7e5dc] dark:border-slate-800">
              <h4 className="text-xs font-bold text-[#13426f] dark:text-[#38bdf8]">+ Tulis Naskah Yap Thread</h4>
              <input
                type="text"
                placeholder="Hook / Topik Utama..."
                value={threadTitle}
                onChange={(e) => setThreadTitle(e.target.value)}
                className="relief-input w-full px-4 py-2 rounded-full text-xs font-bold"
                required
              />

              <textarea
                rows={3}
                placeholder="Tulis isi thread lengkap di sini..."
                value={threadContent}
                onChange={(e) => setThreadContent(e.target.value)}
                className="relief-input w-full px-4 py-2 rounded-2xl text-xs resize-none"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={threadCategory}
                  onChange={(e) => setThreadCategory(e.target.value)}
                  className="relief-input px-3 py-1.5 rounded-full text-xs font-bold"
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>

                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="relief-input px-3 py-1.5 rounded-full text-xs font-mono font-bold"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !threadTitle.trim() || !threadContent.trim()}
                className="w-full py-2.5 relief-btn-pop text-xs font-bold disabled:opacity-40"
              >
                {submitting ? 'Menyimpan...' : '+ Jadwalkan Yap'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
