'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/authContext';
import { supabase } from '../lib/supabase';
import Navbar from './components/Navbar';

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [taskTitle, setTaskTitle] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isReminder, setIsReminder] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');

  const [draftTitle, setDraftTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Makan');

  const [submittingTask, setSubmittingTask] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [toast, setToast] = useState(null);

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalDate, setSelectedCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCalModalOpen, setIsCalModalOpen] = useState(false);

  const categories = [
    { label: 'Makan', icon: '🍲' },
    { label: 'Transport', icon: '🚗' },
    { label: 'Belanja', icon: '🛒' },
    { label: 'Tagihan', icon: '⚡' },
    { label: 'Lainnya', icon: '✨' },
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  };

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = useMemo(() => {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return new Date().toLocaleDateString('id-ID', options);
  }, []);

  useEffect(() => {
    if (user && user.phone_number) {
      fetchData();

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
      const [{ data: tasksData }, { data: expData }] = await Promise.all([
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

      if (tasksData) setTasks(tasksData);
      if (expData) setExpenses(expData);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function addTask(e, customDate = null) {
    if (e) e.preventDefault();
    if (!taskTitle.trim() || !user) return;

    setSubmittingTask(true);
    const targetDate = customDate || today;

    const payload = {
      title: taskTitle.trim(),
      status: 'pending',
      task_date: targetDate,
      phone_number: user.phone_number,
    };

    if (dueTime && dueTime.trim()) {
      payload.due_time = `${dueTime}:00`;
      payload.is_reminder = isReminder;
    }

    try {
      const { data, error } = await supabase.from('tasks').insert([payload]).select().single();
      if (error) throw error;
      if (data) setTasks((prev) => [data, ...prev]);

      setTaskTitle('');
      setDueTime('');
      setIsReminder(false);
      showToast('Tugas berhasil ditambahkan!');
    } catch (err) {
      showToast('Gagal menambahkan tugas', 'error');
    } finally {
      setSubmittingTask(false);
    }
  }

  async function addDraft(e) {
    e.preventDefault();
    if (!draftTitle.trim() || !user) return;

    setSubmittingDraft(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            title: draftTitle.trim(),
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
      showToast('Draft ide tersimpan!');
    } catch (err) {
      showToast('Gagal menyimpan draft ide', 'error');
    } finally {
      setSubmittingDraft(false);
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    if (!expenseAmount || !expenseDesc.trim() || !user) return;

    setSubmittingExpense(true);
    const numericAmount = Number(expenseAmount);
    const descFormatted = `[${selectedCategory}] ${expenseDesc.trim()}`;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([
          {
            amount: numericAmount,
            description: descFormatted,
            expense_date: today,
            phone_number: user.phone_number,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (data) setExpenses((prev) => [data, ...prev]);

      setExpenseAmount('');
      setExpenseDesc('');
      showToast(`Pengeluaran Rp ${numericAmount.toLocaleString('id-ID')} dicatat!`);
    } catch (err) {
      showToast('Gagal mencatat pengeluaran', 'error');
    } finally {
      setSubmittingExpense(false);
    }
  }

  async function toggleTaskStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));
      const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      showToast('Gagal mengubah status', 'error');
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

  async function deleteExpense(id) {
    try {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      showToast('Pengeluaran dihapus');
    } catch (err) {
      showToast('Gagal menghapus pengeluaran', 'error');
      fetchData(false);
    }
  }

  const todayTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesDate = t.task_date === today;
      const notDraft = t.status !== 'draft';
      if (taskFilter === 'all') return matchesDate && notDraft;
      return matchesDate && t.status === taskFilter;
    });
  }, [tasks, today, taskFilter]);

  const draftTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'draft');
  }, [tasks]);

  const todayExpenses = useMemo(() => {
    return expenses.filter((e) => e.expense_date === today);
  }, [expenses, today]);

  const todayExpenseTotal = useMemo(() => {
    return todayExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [todayExpenses]);

  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
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

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (t.status === 'draft') return;
      if (!map[t.task_date]) map[t.task_date] = [];
      map[t.task_date].push(t);
    });
    return map;
  }, [tasks]);

  const selectedCalDateTasks = useMemo(() => {
    return tasks.filter((t) => t.task_date === selectedCalDate && t.status !== 'draft');
  }, [tasks, selectedCalDate]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat Workspace...</span>
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
        {/* Header */}
        <div className="app-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-title)] tracking-tight">
              Daily Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] flex items-center gap-2">
              <span className="capitalize">{formattedDate}</span>
              <span>•</span>
              <span className="font-mono font-bold text-[var(--text-title)]">{currentTime} WIB</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full app-badge-subtle text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WhatsApp Sync Active</span>
            </div>
            <button
              type="button"
              onClick={() => {
                fetchData(true);
                showToast('Data diperbarui! 🔄');
              }}
              className="p-2 rounded-full app-card hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition active:scale-95"
              title="Refresh Data"
            >
              🔄
            </button>
          </div>
        </div>

        {/* 3 Action Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agenda Hari Ini */}
          <div className="app-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <h2 className="font-extrabold text-base text-[var(--text-title)]">Agenda Hari Ini</h2>
                </div>
                <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-full border border-[var(--border-color)] text-[11px] font-bold">
                  {['all', 'pending', 'done'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTaskFilter(f)}
                      className={`px-2.5 py-1 rounded-full capitalize transition ${
                        taskFilter === f
                          ? 'bg-[#13426f] dark:bg-[#0284c7] text-white'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {f === 'all' ? 'Semua' : f}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={addTask} className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tambah agenda hari ini..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="app-input w-full pl-4 pr-24 py-2.5 rounded-full text-xs font-medium"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingTask || !taskTitle.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 app-btn-pop text-xs font-bold disabled:opacity-40"
                  >
                    {submittingTask ? '...' : '+ Tambah'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="app-input px-3 py-1 rounded-full text-[11px] font-mono"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={isReminder}
                      onChange={(e) => setIsReminder(e.target.checked)}
                      className="rounded accent-[#2e96ff]"
                    />
                    <span>🔔 Notif Bot WA</span>
                  </label>
                </div>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {todayTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-2xl border border-dashed border-[var(--border-color)]">
                    Belum ada agenda hari ini.
                  </div>
                ) : (
                  todayTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => toggleTaskStatus(t.id, t.status)}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                        t.status === 'done'
                          ? 'bg-[var(--bg-subtle)] opacity-60 line-through border-[var(--border-color)]'
                          : 'bg-[var(--bg-card)] border-[var(--border-color)] hover:border-[#2e96ff]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          t.status === 'done' ? 'bg-[#2e96ff] border-[#2e96ff] text-white' : 'border-[var(--border-input)]'
                        }`}>
                          {t.status === 'done' && '✓'}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-main)] truncate">{t.title}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {t.due_time && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full app-badge-highlight font-bold">
                            ⏰ {t.due_time.slice(0, 5)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => deleteTask(t.id, e)}
                          className="text-[var(--text-muted)] hover:text-rose-500 text-xs p-1"
                          title="Hapus"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Draft Ide */}
          <div className="app-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💡</span>
                  <h2 className="font-extrabold text-base text-[var(--text-title)]">Draft Ide Cepat</h2>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full app-badge-subtle">
                  {draftTasks.length} Ide
                </span>
              </div>

              <form onSubmit={addDraft} className="relative">
                <input
                  type="text"
                  placeholder="Ketik ide / catatan singkat..."
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="app-input w-full pl-4 pr-24 py-2.5 rounded-full text-xs font-medium"
                  required
                />
                <button
                  type="submit"
                  disabled={submittingDraft || !draftTitle.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 app-btn-pop text-xs font-bold disabled:opacity-40"
                >
                  {submittingDraft ? '...' : '+ Simpan'}
                </button>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {draftTasks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-2xl border border-dashed border-[var(--border-color)]">
                    Belum ada draft ide.
                  </div>
                ) : (
                  draftTasks.map((d) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-[var(--text-main)] leading-relaxed">{d.title}</span>
                      <button
                        type="button"
                        onClick={(e) => deleteTask(d.id, e)}
                        className="text-[var(--text-muted)] hover:text-rose-500 text-xs p-1"
                        title="Hapus"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Pengeluaran Cepat */}
          <div className="app-card p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💸</span>
                  <h2 className="font-extrabold text-base text-[var(--text-title)]">Pengeluaran Hari Ini</h2>
                </div>
                <span className="text-xs font-black font-mono text-[var(--text-title)] bg-[var(--bg-subtle)] px-2.5 py-0.5 rounded-full">
                  Rp {todayExpenseTotal.toLocaleString('id-ID')}
                </span>
              </div>

              <form onSubmit={addExpense} className="space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => setSelectedCategory(cat.label)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                        selectedCategory === cat.label
                          ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Nominal (Rp)"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="app-input px-3.5 py-2 rounded-full text-xs font-mono font-bold"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Keterangan..."
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="app-input px-3.5 py-2 rounded-full text-xs"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingExpense || !expenseAmount || !expenseDesc.trim()}
                  className="w-full py-2.5 app-btn-pop text-xs font-bold disabled:opacity-40"
                >
                  {submittingExpense ? 'Menyimpan...' : '+ Catat Pengeluaran'}
                </button>
              </form>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {todayExpenses.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-2xl border border-dashed border-[var(--border-color)]">
                    Belum ada pengeluaran hari ini.
                  </div>
                ) : (
                  todayExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-2.5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between text-xs"
                    >
                      <span className="text-[var(--text-main)] font-medium truncate max-w-[170px]">{exp.description}</span>
                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className="font-bold text-rose-500">-Rp {Number(exp.amount).toLocaleString('id-ID')}</span>
                        <button
                          type="button"
                          onClick={() => deleteExpense(exp.id)}
                          className="text-[var(--text-muted)] hover:text-rose-500 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <section className="app-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-title)] flex items-center justify-center font-bold text-lg shadow-sm">
                🗓️
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[var(--text-title)]">
                  Kalender Agenda — {monthNamesIndo[currentMonth]} {currentYear}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Klik kotak tanggal untuk melihat atau membuat agenda baru
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCalendarDate(new Date(currentYear, currentMonth - 1, 1))}
                className="p-2 rounded-full app-card hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-bold transition"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalendarDate(new Date());
                  setSelectedCalDate(today);
                }}
                className="px-4 py-1.5 rounded-full app-card hover:bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-title)] transition"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(new Date(currentYear, currentMonth + 1, 1))}
                className="p-2 rounded-full app-card hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] text-xs font-bold transition"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden bg-[var(--bg-card)] shadow-sm">
            <div className="grid grid-cols-7 bg-[var(--bg-subtle)] border-b border-[var(--border-color)] text-center text-xs font-bold text-[var(--text-muted)] uppercase py-3">
              {daysOfWeek.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-color)]">
              {calendarDays.map((item, idx) => {
                const isToday = item.dateString === today;
                const isSelected = item.dateString === selectedCalDate;
                const dayTasks = tasksByDate[item.dateString] || [];

                return (
                  <div
                    key={`${item.dateString}-${idx}`}
                    onClick={() => {
                      setSelectedCalDate(item.dateString);
                      setIsCalModalOpen(true);
                    }}
                    className={`min-h-[110px] p-2 transition flex flex-col justify-between cursor-pointer group ${
                      !item.isCurrentMonth
                        ? 'opacity-30 bg-[var(--bg-subtle)]'
                        : isToday
                        ? 'bg-[#2e96ff]/10'
                        : 'hover:bg-[var(--bg-subtle)]'
                    } ${isSelected ? 'ring-2 ring-inset ring-[#2e96ff]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          isToday
                            ? 'bg-[#2e96ff] text-white shadow-sm'
                            : 'text-[var(--text-main)]'
                        }`}
                      >
                        {item.dayNumber}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#13426f] dark:bg-[#0284c7] text-white">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1 overflow-hidden flex-1 max-h-[60px]">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium truncate ${
                            t.status === 'done'
                              ? 'bg-[var(--bg-subtle)] text-[var(--text-muted)] line-through border-[var(--border-color)]'
                              : 'app-badge-highlight font-bold'
                          }`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <span className="text-[9px] text-[#2e96ff] font-bold block pl-1">
                          +{dayTasks.length - 2} lagi
                        </span>
                      )}
                    </div>

                    <div className="text-[9px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition flex justify-end">
                      <span className="text-[#2e96ff] font-bold">+ Agenda</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      {/* Agenda Detail Modal */}
      {isCalModalOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="app-card w-full max-w-xl p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-title)]">
                  Agenda Tanggal:{' '}
                  <span className="text-[#2e96ff]">
                    {new Date(selectedCalDate + 'T00:00:00').toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCalModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] hover:bg-rose-500/20 text-[var(--text-muted)] hover:text-rose-500 flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-[var(--text-muted)]">
                Daftar Agenda ({selectedCalDateTasks.length})
              </h4>
              {selectedCalDateTasks.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded-2xl border border-dashed border-[var(--border-color)]">
                  Tidak ada agenda di tanggal ini.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedCalDateTasks.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                          t.status === 'done' ? 'bg-[#2e96ff] text-white border-[#2e96ff]' : 'border-[var(--border-input)]'
                        }`}>
                          {t.status === 'done' && '✓'}
                        </span>
                        <span className={`text-xs font-medium ${t.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-main)]'}`}>
                          {t.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteTask(t.id, e)}
                        className="text-xs text-[var(--text-muted)] hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                addTask(e, selectedCalDate);
              }}
              className="space-y-3 pt-3 border-t border-[var(--border-color)]"
            >
              <h4 className="text-xs font-bold text-[var(--text-title)]">+ Tambah Agenda di Tanggal Ini</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ketik nama agenda..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="app-input flex-1 px-4 py-2 rounded-full text-xs font-medium"
                  required
                />
                <button
                  type="submit"
                  disabled={submittingTask || !taskTitle.trim()}
                  className="px-5 py-2 app-btn-pop text-xs font-bold disabled:opacity-40"
                >
                  {submittingTask ? '...' : '+ Tambah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
