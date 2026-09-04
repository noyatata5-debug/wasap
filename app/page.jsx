'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  // Data States
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueTime, setTaskDueTime] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Makan');
  const [taskFilter, setTaskFilter] = useState('all'); // 'all' | 'pending' | 'done'
  const [loading, setLoading] = useState(true);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [toast, setToast] = useState(null);

  // --- BIG CALENDAR & WALL NOTES STATE ---
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [modalNewTaskTitle, setModalNewTaskTitle] = useState('');
  const [modalDueTime, setModalDueTime] = useState('');
  const [modalTaskColor, setModalTaskColor] = useState('yellow'); // sticky note style
  const [calendarFilter, setCalendarFilter] = useState('all'); // 'all' | 'pending' | 'done' | 'expenses'

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Sticky notes palette
  const stickyColors = {
    yellow: {
      bg: 'bg-amber-400/15 border-amber-400/40 text-amber-200',
      dot: 'bg-amber-400',
      pin: '📌',
      label: 'Kuning (Prioritas)',
    },
    emerald: {
      bg: 'bg-emerald-400/15 border-emerald-400/40 text-emerald-200',
      dot: 'bg-emerald-400',
      pin: '🌱',
      label: 'Hijau (Rutin/Santai)',
    },
    pink: {
      bg: 'bg-rose-400/15 border-rose-400/40 text-rose-200',
      dot: 'bg-rose-400',
      pin: '🌸',
      label: 'Merah Muda (Penting)',
    },
    blue: {
      bg: 'bg-sky-400/15 border-sky-400/40 text-sky-200',
      dot: 'bg-sky-400',
      pin: '💎',
      label: 'Biru (Fokus/Kerja)',
    },
    purple: {
      bg: 'bg-purple-400/15 border-purple-400/40 text-purple-200',
      dot: 'bg-purple-400',
      pin: '🔮',
      label: 'Ungu (Ide/Kreatif)',
    },
  };

  // Quick expense shortcut presets
  const expensePresets = [10000, 25000, 50000, 100000];
  const expenseCategories = [
    { label: 'Makan', icon: '🍔' },
    { label: 'Transport', icon: '🚗' },
    { label: 'Belanja', icon: '🛍️' },
    { label: 'Tagihan', icon: '⚡' },
    { label: 'Lainnya', icon: '📝' },
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Auth Guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Live Clock & Formatted Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = useMemo(() => {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return new Date().toLocaleDateString('id-ID', options);
  }, []);

  // Fetch initial data & Realtime channel subscription per user's phone_number
  useEffect(() => {
    if (user && user.phone_number) {
      fetchData();

      // Supabase Realtime channel
      const channel = supabase
        .channel(`user-realtime-${user.phone_number}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          fetchData(false);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
          fetchData(false);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  async function fetchData(showLoader = true) {
    if (!user) return;
    if (showLoader) setLoading(true);

    try {
      const [{ data: tData, error: tErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
          .order('id', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
          .order('id', { ascending: false }),
      ]);

      if (tErr) console.error('Error fetching tasks:', tErr);
      if (eErr) console.error('Error fetching expenses:', eErr);

      if (tData) setTasks(tData);
      if (eData) setExpenses(eData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  // --- TASK ACTIONS ---
  async function addTaskForDate(titleText, targetDate = today, dueTime = null) {
    if (!titleText.trim() || !user) return;

    const newTitle = titleText.trim();
    try {
      const insertPayload = {
        title: newTitle,
        status: 'pending',
        task_date: targetDate,
        phone_number: user.phone_number,
      };
      if (dueTime && dueTime.trim()) {
        insertPayload.due_time = dueTime.trim();
        insertPayload.is_reminder = true;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setTasks((prev) => [data, ...prev]);
      }
      showToast(
        targetDate === today
          ? 'Tugas baru berhasil ditambahkan ke Hari Ini! 🚀'
          : `Tugas dijadwalkan untuk ${targetDate}! 📌`
      );
      fetchData(false);
    } catch (err) {
      showToast('Gagal menambahkan tugas', 'error');
      console.error(err);
    }
  }

  async function addTask(e) {
    e.preventDefault();
    setSubmittingTask(true);
    await addTaskForDate(taskTitle, today, taskDueTime);
    setTaskTitle('');
    setTaskDueTime('');
    setSubmittingTask(false);
  }

  async function addDraft(e) {
    e.preventDefault();
    if (!draftTitle.trim() || !user) return;

    setSubmittingDraft(true);
    const newDraft = draftTitle.trim();
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            title: newDraft,
            status: 'draft',
            task_date: today,
            phone_number: user.phone_number,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) setTasks((prev) => [data, ...prev]);
      setDraftTitle('');
      showToast('Draft ide disimpan ke backlog! 💡');
      fetchData(false);
    } catch (err) {
      showToast('Gagal menyimpan draft ide', 'error');
      console.error(err);
    } finally {
      setSubmittingDraft(false);
    }
  }

  async function promoteDraftToDate(id, title, targetDate = today) {
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'pending', task_date: targetDate } : t))
      );
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'pending', task_date: targetDate })
        .eq('id', id);

      if (error) throw error;
      showToast(`"${title}" dipindahkan ke jadwal ${targetDate === today ? 'Hari Ini' : targetDate}! ✨`);
      fetchData(false);
    } catch (err) {
      showToast('Gagal memindahkan draft', 'error');
      console.error(err);
    }
  }

  async function toggleDone(id, currentStatus) {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
      const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
      if (nextStatus === 'done') {
        showToast('Hebat! Tugas selesai 🎉');
      }
    } catch (err) {
      showToast('Gagal mengupdate status tugas', 'error');
      fetchData(false);
    }
  }

  async function deleteTask(id, e) {
    if (e) e.stopPropagation();
    try {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      showToast('Tugas dihapus');
    } catch (err) {
      showToast('Gagal menghapus tugas', 'error');
      fetchData(false);
    }
  }

  // --- EXPENSE ACTIONS ---
  async function addExpense(e) {
    e.preventDefault();
    if (!expAmount || !expDesc.trim() || !user) return;

    setSubmittingExpense(true);
    const amountVal = Number(expAmount);
    const descFormatted = selectedCategory ? `[${selectedCategory}] ${expDesc.trim()}` : expDesc.trim();

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([
          {
            amount: amountVal,
            description: descFormatted,
            expense_date: today,
            phone_number: user.phone_number,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) setExpenses((prev) => [data, ...prev]);
      setExpAmount('');
      setExpDesc('');
      showToast(`Pengeluaran Rp ${amountVal.toLocaleString('id-ID')} dicatat! 💸`);
      fetchData(false);
    } catch (err) {
      showToast('Gagal mencatat pengeluaran', 'error');
      console.error(err);
    } finally {
      setSubmittingExpense(false);
    }
  }

  async function deleteExpense(id) {
    try {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      showToast('Catatan pengeluaran dihapus');
    } catch (err) {
      showToast('Gagal menghapus pengeluaran', 'error');
      fetchData(false);
    }
  }

  // --- FILTERED DATA & COMPUTED STATS ---
  const todayTasks = useMemo(() => {
    return tasks.filter((t) => t.task_date === today && t.status !== 'draft');
  }, [tasks, today]);

  const displayedTodayTasks = useMemo(() => {
    if (taskFilter === 'pending') return todayTasks.filter((t) => t.status === 'pending');
    if (taskFilter === 'done') return todayTasks.filter((t) => t.status === 'done');
    return todayTasks;
  }, [todayTasks, taskFilter]);

  const draftTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'draft');
  }, [tasks]);

  const completedCount = useMemo(() => {
    return todayTasks.filter((t) => t.status === 'done').length;
  }, [todayTasks]);

  const progressPercentage = useMemo(() => {
    if (todayTasks.length === 0) return 0;
    return Math.round((completedCount / todayTasks.length) * 100);
  }, [todayTasks.length, completedCount]);

  const todayExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date === today);
  }, [expenses, today]);

  const totalExpenseToday = useMemo(() => {
    return todayExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [todayExpenses]);

  // --- BIG CALENDAR GRID GENERATOR ---
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();

  const monthNamesIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun, 1 = Mon ...
    const adjustedFirstDay = (firstDayIndex + 6) % 7;

    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Leading days
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

    // Trailing days
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

  // Tasks & Expenses Map per Date for Big Calendar
  const dataByDate = useMemo(() => {
    const map = {};

    // Group tasks
    tasks.forEach((t) => {
      if (t.task_date && t.status !== 'draft') {
        if (!map[t.task_date]) map[t.task_date] = { tasks: [], expenses: [], totalExpense: 0 };
        map[t.task_date].tasks.push(t);
      }
    });

    // Group expenses
    expenses.forEach((e) => {
      if (e.expense_date) {
        if (!map[e.expense_date]) map[e.expense_date] = { tasks: [], expenses: [], totalExpense: 0 };
        map[e.expense_date].expenses.push(e);
        map[e.expense_date].totalExpense += Number(e.amount || 0);
      }
    });

    return map;
  }, [tasks, expenses]);

  // Modal active date data
  const selectedDateData = useMemo(() => {
    return dataByDate[selectedCalendarDate] || { tasks: [], expenses: [], totalExpense: 0 };
  }, [dataByDate, selectedCalendarDate]);

  const openCalendarModal = (dateStr) => {
    setSelectedCalendarDate(dateStr);
    setIsCalendarModalOpen(true);
  };

  const handleModalAddTask = async (e) => {
    e.preventDefault();
    if (!modalNewTaskTitle.trim()) return;
    await addTaskForDate(modalNewTaskTitle, selectedCalendarDate, modalDueTime);
    setModalNewTaskTitle('');
    setModalDueTime('');
  };

  // Loading or redirecting state
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat workspace Anda...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-emerald-500 selection:text-black pb-24">
      {/* Dynamic Ambient Background Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed top-36 right-1/4 w-[500px] h-[500px] bg-emerald-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed bottom-20 left-1/3 w-[450px] h-[450px] bg-amber-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all transform animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/40 text-rose-200'
              : 'bg-slate-900/90 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span className="text-base">{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        {/* --- TOP PROFILE & ACTION BAR --- */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-slate-950 shadow-md">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">@{user.username}</span>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                +{user.phone_number}
              </span>
              {user.role === 'admin' && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Admin
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-semibold transition"
              >
                <span>👥 Kelola User (Admin)</span>
              </Link>
            )}
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              title="Keluar Akun"
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-300 text-xs font-medium transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* --- HEADER SECTION --- */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-emerald-500/10 via-teal-500/5 to-transparent pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            {/* Left: Brand & Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-glow-emerald">
                  <span className="text-xl">🚀</span>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    Wasap Daily Hub
                  </h1>
                </div>
              </div>
              <p className="text-sm text-slate-400 flex items-center gap-2 flex-wrap">
                <span className="capitalize">{formattedDate}</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-emerald-400 font-semibold">{currentTime} WIB</span>
              </p>
            </div>

            {/* Right: Live WhatsApp Badge & Refresh */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-inner">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>WA Sync (+{user.phone_number})</span>
              </div>

              <button
                onClick={() => {
                  fetchData();
                  showToast('Data diperbarui! 🔄');
                }}
                title="Refresh Data"
                className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-all hover:scale-105 active:scale-95"
              >
                <svg
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
            {/* Metric 1: Tasks Completion */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Progres Tugas Hari Ini</span>
                <p className="text-xl font-bold text-white mt-1">
                  {completedCount} <span className="text-sm font-normal text-slate-400">/ {todayTasks.length} Selesai</span>
                </p>
                <div className="w-32 bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-400">{progressPercentage}%</span>
              </div>
            </div>

            {/* Metric 2: Today's Expense */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Pengeluaran Hari Ini</span>
                <p className="text-xl font-black text-emerald-400 mt-1">
                  Rp {totalExpenseToday.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-slate-500 mt-1">{todayExpenses.length} transaksi tercatat</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                💳
              </div>
            </div>

            {/* Metric 3: Backlog / Ideas */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Draft & Ide Backlog</span>
                <p className="text-xl font-bold text-amber-400 mt-1">
                  {draftTasks.length} <span className="text-sm font-normal text-slate-400">Ide tersimpan</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">Siap dijadwalkan ke kalender</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                💡
              </div>
            </div>
          </div>
        </header>

        {/* --- 3-COLUMN MAIN WORKSPACE --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ================= COLUMN 1: TUGAS HARI INI ================= */}
          <section className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all duration-300">
            <div className="space-y-4">
              {/* Header & Filter Tabs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-lg text-white">Tugas Hari Ini</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
                  {todayTasks.length} Total
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-1 p-1 bg-slate-900/80 rounded-xl border border-slate-800 text-xs font-medium">
                {['all', 'pending', 'done'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setTaskFilter(f)}
                    className={`flex-1 py-1.5 rounded-lg capitalize transition-all ${
                      taskFilter === f
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'Semua' : f === 'pending' ? 'Belum' : 'Selesai'}
                  </button>
                ))}
              </div>

              {/* Add Task Form */}
              <form onSubmit={addTask} className="space-y-2">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Tulis tugas baru hari ini..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="glass-input w-full pl-4 pr-12 py-3 rounded-xl text-sm placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    disabled={submittingTask || !taskTitle.trim()}
                    className="absolute right-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 text-white text-xs font-semibold transition-all shadow-md"
                  >
                    {submittingTask ? '...' : '+ Add'}
                  </button>
                </div>
                <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">⏰ Reminder Jam:</span>
                  <input
                    type="time"
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className="glass-input px-2 py-1 rounded-lg text-xs font-mono text-slate-200 bg-slate-900/90"
                  />
                  {taskDueTime && (
                    <button
                      type="button"
                      onClick={() => setTaskDueTime('')}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </form>

              {/* Task Items List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {displayedTodayTasks.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-2">
                    <span className="text-3xl">☕</span>
                    <p className="text-sm font-medium text-slate-400">
                      {taskFilter === 'done'
                        ? 'Belum ada tugas yang selesai.'
                        : taskFilter === 'pending'
                        ? 'Tidak ada tugas yang tertunda! Santai sejenak.'
                        : 'Belum ada tugas untuk hari ini.'}
                    </p>
                    <p className="text-xs text-slate-600">Tambah tugas di atas, via kalender di bawah, atau bot WA</p>
                  </div>
                ) : (
                  displayedTodayTasks.map((t) => {
                    const isDone = t.status === 'done';
                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleDone(t.id, t.status)}
                        className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isDone
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-65 hover:opacity-100'
                            : 'bg-slate-900/80 border-slate-800 hover:border-blue-500/40 hover:shadow-glow-violet'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <button
                            type="button"
                            aria-label="Toggle status"
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-600 group-hover:border-blue-400'
                            }`}
                          >
                            {isDone && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex flex-col">
                            <span
                              className={`text-sm select-none break-words ${
                                isDone ? 'line-through text-slate-500' : 'text-slate-200 font-medium'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.due_time && (
                              <span className="flex items-center gap-1 text-[11px] font-mono text-amber-300/90 mt-0.5">
                                <span>⏰</span> {t.due_time.slice(0, 5)} WIB
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => deleteTask(t.id, e)}
                          title="Hapus Tugas"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/60 flex justify-between">
              <span>Klik tugas untuk tandai selesai</span>
              <span>{completedCount} Selesai</span>
            </div>
          </section>

          {/* ================= COLUMN 2: DRAFT RENCANA & IDE ================= */}
          <section className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    💡
                  </div>
                  <h2 className="font-bold text-lg text-white">Draft & Ide Backlog</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold">
                  {draftTasks.length} Ide
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Tempat menampung ide kasar sebelum dijadwalkan ke hari ini atau kalender.
              </p>

              {/* Add Draft Form */}
              <form onSubmit={addDraft} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Catat ide / draft baru..."
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="glass-input w-full pl-4 pr-12 py-3 rounded-xl text-sm placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20"
                />
                <button
                  type="submit"
                  disabled={submittingDraft || !draftTitle.trim()}
                  className="absolute right-2 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-md"
                >
                  {submittingDraft ? '...' : '+ Simpan'}
                </button>
              </form>

              {/* Draft Items List */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {draftTasks.length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-2">
                    <span className="text-3xl">✨</span>
                    <p className="text-sm font-medium text-slate-400">Belum ada ide di draft.</p>
                    <p className="text-xs text-slate-600">Simpan ide apa saja agar tidak lupa!</p>
                  </div>
                ) : (
                  draftTasks.map((d) => (
                    <div
                      key={d.id}
                      className="group relative p-4 rounded-2xl bg-gradient-to-b from-amber-950/20 to-slate-900/80 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-glow-amber transition-all space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-slate-200 font-medium break-words leading-relaxed">
                          {d.title}
                        </p>
                        <button
                          onClick={(e) => deleteTask(d.id, e)}
                          title="Hapus Draft"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => promoteDraftToDate(d.id, d.title, today)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all hover:scale-102 active:scale-95"
                        >
                          <span>⚡ Jadwalkan Hari Ini</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/60 flex justify-between">
              <span>Klik &quot;Jadwalkan&quot; untuk pindah ke hari ini</span>
              <span>{draftTasks.length} Backlog</span>
            </div>
          </section>

          {/* ================= COLUMN 3: CATAT PENGELUARAN ================= */}
          <section className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all duration-300">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    💳
                  </div>
                  <h2 className="font-bold text-lg text-white">Catat Pengeluaran</h2>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                  Rp {totalExpenseToday.toLocaleString('id-ID')}
                </span>
              </div>

              {/* Expense Form */}
              <form onSubmit={addExpense} className="space-y-3">
                {/* Category Selector Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {expenseCategories.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setSelectedCategory(cat.label)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                        selectedCategory === cat.label
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>

                {/* Amount Input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    placeholder="Nominal (contoh: 25000)"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 font-mono"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Quick:</span>
                  {expensePresets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setExpAmount(p.toString())}
                      className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 font-mono transition"
                    >
                      +{p / 1000}k
                    </button>
                  ))}
                </div>

                {/* Description Input */}
                <input
                  type="text"
                  placeholder="Keterangan (misal: Nasi Padang, Bensin)"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                />

                <button
                  type="submit"
                  disabled={submittingExpense || !expAmount || !expDesc.trim()}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 disabled:opacity-40 text-white font-bold text-sm transition-all shadow-glow-emerald"
                >
                  {submittingExpense ? 'Menyimpan...' : 'Simpan Pengeluaran'}
                </button>
              </form>

              {/* Transactions List */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 pt-1">
                {expenses.length === 0 ? (
                  <div className="py-8 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 space-y-1">
                    <span className="text-2xl">💰</span>
                    <p className="text-sm font-medium text-slate-400">Belum ada pengeluaran.</p>
                  </div>
                ) : (
                  expenses.map((e) => {
                    const isExpenseToday = e.expense_date === today;
                    return (
                      <div
                        key={e.id}
                        className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                          isExpenseToday
                            ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40'
                            : 'bg-slate-950/40 border-slate-900 opacity-60'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-medium text-slate-200 truncate">{e.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono text-slate-500">{e.expense_date}</span>
                            {isExpenseToday && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                Hari Ini
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-emerald-400 whitespace-nowrap">
                            Rp {Number(e.amount || 0).toLocaleString('id-ID')}
                          </span>
                          <button
                            onClick={() => deleteExpense(e.id)}
                            title="Hapus Transaksi"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/60 flex justify-between">
              <span>Total semua transaksi: {expenses.length}</span>
              <span className="font-mono text-emerald-400 font-semibold">
                Rp {totalExpenseToday.toLocaleString('id-ID')} hari ini
              </span>
            </div>
          </section>

        </div>

        {/* ========================================================================= */}
        {/* ============= BIG DARK AESTHETIC PINBOARD WALL CALENDAR ================= */}
        {/* ========================================================================= */}
        <section className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6 shadow-glass border border-slate-800 relative overflow-hidden">
          {/* Subtle Corkboard / Pinboard Ambient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Calendar Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-purple-500/20 to-emerald-500/20 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                📌
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-white capitalize">
                    {monthNamesIndo[currentMonth]} {currentYear}
                  </h2>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">
                    Pinboard Notes
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kalender dinding estetik terintegrasi dengan tugas harian & catatan pengeluaran Anda.
                </p>
              </div>
            </div>

            {/* Navigation & Controls */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Filter Tabs on Calendar */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { key: 'all', label: 'Semua' },
                  { key: 'pending', label: '⏳ Belum' },
                  { key: 'done', label: '✅ Selesai' },
                  { key: 'expenses', label: '💳 Pengeluaran' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setCalendarFilter(f.key)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
                      calendarFilter === f.key
                        ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Month Navigation */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCalendarDate(new Date(currentYear, currentMonth - 1, 1))}
                  title="Bulan Sebelumnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setCalendarDate(new Date());
                    setSelectedCalendarDate(today);
                  }}
                  className="px-3 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition"
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setCalendarDate(new Date(currentYear, currentMonth + 1, 1))}
                  title="Bulan Berikutnya"
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => openCalendarModal(today)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 text-xs font-bold transition shadow-glow-amber flex items-center gap-1.5 active:scale-95"
              >
                <span>+ Tempel Catatan</span>
              </button>
            </div>
          </div>

          {/* Large Dark Calendar Grid */}
          <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/60 shadow-2xl relative z-10">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-900/90 border-b border-slate-800 text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-3">
              {daysOfWeek.map((day, idx) => (
                <div key={day} className={idx >= 5 ? 'text-rose-400/90' : 'text-slate-300'}>
                  {day}
                </div>
              ))}
            </div>

            {/* Date Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/60 bg-slate-950/40">
              {calendarDays.map((item, index) => {
                const isToday = item.dateString === today;
                const isSelected = item.dateString === selectedCalendarDate;
                const dateEntry = dataByDate[item.dateString] || { tasks: [], expenses: [], totalExpense: 0 };

                // Filter tasks based on calendarFilter
                let visibleTasks = dateEntry.tasks;
                if (calendarFilter === 'pending') visibleTasks = visibleTasks.filter((t) => t.status === 'pending');
                if (calendarFilter === 'done') visibleTasks = visibleTasks.filter((t) => t.status === 'done');
                if (calendarFilter === 'expenses') visibleTasks = [];

                const showExpenses = calendarFilter === 'all' || calendarFilter === 'expenses';

                return (
                  <div
                    key={`${item.dateString}-${index}`}
                    onClick={() => openCalendarModal(item.dateString)}
                    className={`min-h-[125px] sm:min-h-[145px] p-2 sm:p-2.5 transition-all flex flex-col justify-between cursor-pointer group relative ${
                      !item.isCurrentMonth
                        ? 'bg-slate-950/80 text-slate-600 opacity-35 hover:opacity-80'
                        : isToday
                        ? 'bg-gradient-to-b from-indigo-950/40 to-slate-900/60 border-indigo-500/50 shadow-inner'
                        : 'hover:bg-slate-900/70 text-slate-300'
                    } ${isSelected ? 'ring-2 ring-inset ring-amber-400/80' : ''}`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-all ${
                          isToday
                            ? 'bg-gradient-to-tr from-emerald-500 to-indigo-500 text-slate-950 font-black shadow-glow-emerald scale-105'
                            : 'group-hover:bg-slate-800 group-hover:text-white text-slate-300'
                        }`}
                      >
                        {item.dayNumber}
                      </span>

                      <div className="flex items-center gap-1">
                        {dateEntry.tasks.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {dateEntry.tasks.length}
                          </span>
                        )}
                        {dateEntry.totalExpense > 0 && showExpenses && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                            -{Math.round(dateEntry.totalExpense / 1000)}k
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Sticky Note Badges List */}
                    <div className="space-y-1.5 my-1.5 overflow-hidden flex-1 max-h-[85px]">
                      {visibleTasks.slice(0, 3).map((t, tIdx) => {
                        const isDone = t.status === 'done';
                        const colorKeys = Object.keys(stickyColors);
                        const assignedStyle = stickyColors[colorKeys[tIdx % colorKeys.length]];

                        return (
                          <div
                            key={t.id}
                            title={`${t.title}${t.due_time ? ` (⏰ ${t.due_time.slice(0, 5)})` : ''}`}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium border truncate transition-all shadow-sm ${
                              isDone
                                ? 'bg-slate-900/60 border-slate-800 text-slate-500 line-through opacity-60'
                                : `${assignedStyle.bg} ${assignedStyle.border} ${assignedStyle.text} hover:scale-102`
                            }`}
                          >
                            <span className="text-[9px]">{isDone ? '✅' : (t.due_time ? '⏰' : assignedStyle.pin)}</span>
                            <span className="truncate">{t.due_time ? `[${t.due_time.slice(0, 5)}] ` : ''}{t.title}</span>
                          </div>
                        );
                      })}

                      {visibleTasks.length > 3 && (
                        <span className="text-[10px] text-amber-400/80 font-bold block pl-1">
                          +{visibleTasks.length - 3} catatan lainnya...
                        </span>
                      )}

                      {/* Small expense preview if filtered */}
                      {calendarFilter === 'expenses' && dateEntry.expenses.slice(0, 2).map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 truncate"
                        >
                          <span className="truncate">{exp.description}</span>
                          <span className="font-bold">Rp {exp.amount?.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>

                    {/* Bottom: Quick prompt on hover */}
                    <div className="text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between pt-1 border-t border-slate-800/40">
                      <span className="text-slate-400">Detail</span>
                      <span className="text-amber-400 font-semibold">+ Note 📌</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ============= MODAL: DETAIL CATATAN KALENDER DINDING ==================== */}
      {/* ========================================================================= */}
      {isCalendarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 sm:p-8 space-y-6 border border-amber-500/30 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">📌</span>
                  <h3 className="text-xl font-bold text-white">
                    Catatan Tanggal:{' '}
                    <span className="text-amber-400">
                      {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    {selectedCalendarDate === today && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                        Hari Ini
                      </span>
                    )}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Tugas yang ditambahkan di sini otomatis terhubung dengan dashboard harian.
                </p>
              </div>

              <button
                onClick={() => setIsCalendarModalOpen(false)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* List of tasks on this date */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span>📋 Daftar Tugas & Catatan ({selectedDateData.tasks.length})</span>
                </h4>
                {selectedDateData.totalExpense > 0 && (
                  <span className="text-xs font-mono text-emerald-400 font-semibold">
                    Total Pengeluaran: Rp {selectedDateData.totalExpense.toLocaleString('id-ID')}
                  </span>
                )}
              </div>

              {selectedDateData.tasks.length === 0 ? (
                <div className="py-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-xs text-slate-500 space-y-1">
                  <p>Belum ada catatan atau tugas di tanggal ini.</p>
                  <p className="text-slate-600">Gunakan form di bawah untuk menempelkan catatan baru.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedDateData.tasks.map((t, idx) => {
                    const isDone = t.status === 'done';
                    const colorKeys = Object.keys(stickyColors);
                    const assignedStyle = stickyColors[colorKeys[idx % colorKeys.length]];

                    return (
                      <div
                        key={t.id}
                        onClick={() => toggleDone(t.id, t.status)}
                        className={`group p-3 rounded-2xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                          isDone
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                            : `${assignedStyle.bg} ${assignedStyle.border}`
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <button
                            type="button"
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                                : 'border-slate-600 group-hover:border-amber-400'
                            }`}
                          >
                            {isDone && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex flex-col">
                            <span
                              className={`text-sm font-medium break-words ${
                                isDone ? 'line-through text-slate-500' : 'text-slate-100'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.due_time && (
                              <span className="flex items-center gap-1 text-xs font-mono text-amber-300 mt-0.5">
                                <span>⏰</span> {t.due_time.slice(0, 5)} WIB
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => deleteTask(t.id, e)}
                          title="Hapus Catatan"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
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

            {/* List of expenses on this date if any */}
            {selectedDateData.expenses.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span>💳 Pengeluaran Tanggal Ini ({selectedDateData.expenses.length})</span>
                </h4>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedDateData.expenses.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
                    >
                      <span className="text-slate-300 font-medium truncate">{e.description}</span>
                      <span className="font-mono font-bold text-emerald-400">
                        Rp {Number(e.amount || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Note / Task form for this date */}
            <form onSubmit={handleModalAddTask} className="space-y-4 pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                + Tempel Catatan / Tugas Baru di Tanggal Ini
              </h4>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ketik catatan atau tugas baru..."
                    value={modalNewTaskTitle}
                    onChange={(e) => setModalNewTaskTitle(e.target.value)}
                    className="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm placeholder:text-slate-500 focus:border-amber-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={!modalNewTaskTitle.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition shadow-glow-amber active:scale-95 whitespace-nowrap"
                  >
                    + Tempel
                  </button>
                </div>
                <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">⏰ Reminder Jam:</span>
                  <input
                    type="time"
                    value={modalDueTime}
                    onChange={(e) => setModalDueTime(e.target.value)}
                    className="glass-input px-2.5 py-1 rounded-lg text-xs font-mono text-slate-200 bg-slate-900/90"
                  />
                  {modalDueTime && (
                    <button
                      type="button"
                      onClick={() => setModalDueTime('')}
                      className="text-[10px] text-rose-400 hover:underline"
                    >
                      Reset Jam
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
