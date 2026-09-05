'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';

export default function PersonalFinancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // View Timeframe Mode: 'daily' | 'monthly' | 'yearly'
  const [timeframe, setTimeframe] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [trxType, setTrxType] = useState('expense'); // 'income' | 'expense'
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [trxDate, setTrxDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const incomeCategories = ['Gaji', 'Freelance', 'Bisnis', 'Investasi', 'Hadiah / Bonus', 'Lainnya'];
  const expenseCategories = ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Keluarga', 'Lainnya'];

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.phone_number) {
      fetchFinanceData();

      const channel = supabase
        .channel(`finance-realtime-${user.phone_number}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => fetchFinanceData(false))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchFinanceData(false))
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  async function fetchFinanceData(showLoader = true) {
    if (!user) return;
    if (showLoader) setLoading(true);

    try {
      const [{ data: incData, error: incErr }, { data: expData, error: expErr }] = await Promise.all([
        supabase
          .from('incomes')
          .select('*')
          .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
          .order('income_date', { ascending: false }),
        supabase
          .from('expenses')
          .select('*')
          .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
          .order('expense_date', { ascending: false }),
      ]);

      if (incErr) console.error('Fetch incomes error:', incErr);
      if (expErr) console.error('Fetch expenses error:', expErr);

      if (incData) setIncomes(incData);
      if (expData) setExpenses(expData);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  async function handleAddTransaction(e) {
    e.preventDefault();
    if (!amount || !description.trim() || !user) return;

    setSubmitting(true);
    const numAmount = Number(amount);
    const finalDesc = description.trim();

    try {
      if (trxType === 'income') {
        const { error } = await supabase.from('incomes').insert([
          {
            phone_number: user.phone_number,
            amount: numAmount,
            category: category,
            description: `[${category}] ${finalDesc}`,
            income_date: trxDate,
          },
        ]);
        if (error) throw error;
        showToast(`Pemasukan Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat! 📈`);
      } else {
        const { error } = await supabase.from('expenses').insert([
          {
            phone_number: user.phone_number,
            amount: numAmount,
            category: category,
            description: `[${category}] ${finalDesc}`,
            expense_date: trxDate,
          },
        ]);
        if (error) throw error;
        showToast(`Pengeluaran Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat! 💸`);
      }

      setAmount('');
      setDescription('');
      fetchFinanceData(false);
    } catch (err) {
      showToast('Gagal menyimpan transaksi', 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTransaction(type, id) {
    try {
      const table = type === 'income' ? 'incomes' : 'expenses';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      if (type === 'income') {
        setIncomes(prev => prev.filter(i => i.id !== id));
      } else {
        setExpenses(prev => prev.filter(e => e.id !== id));
      }
      showToast('Transaksi berhasil dihapus');
    } catch (err) {
      showToast('Gagal menghapus transaksi', 'error');
    }
  }

  // --- TIMEFRAME FILTERED DATA ---
  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      const date = i.income_date;
      if (!date) return false;
      const [y, m, d] = date.split('-').map(Number);
      if (timeframe === 'daily') return date === selectedDateStr;
      if (timeframe === 'monthly') return y === selectedYear && m === selectedMonth + 1;
      if (timeframe === 'yearly') return y === selectedYear;
      return true;
    });
  }, [incomes, timeframe, selectedDateStr, selectedYear, selectedMonth]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const date = e.expense_date;
      if (!date) return false;
      const [y, m, d] = date.split('-').map(Number);
      if (timeframe === 'daily') return date === selectedDateStr;
      if (timeframe === 'monthly') return y === selectedYear && m === selectedMonth + 1;
      if (timeframe === 'yearly') return y === selectedYear;
      return true;
    });
  }, [expenses, timeframe, selectedDateStr, selectedYear, selectedMonth]);

  const totalIncome = useMemo(() => {
    return filteredIncomes.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [filteredIncomes]);

  const totalExpense = useMemo(() => {
    return filteredExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  }, [filteredExpenses]);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // --- MONTHLY CASHFLOW BREAKDOWN FOR CHART (12 Months of Selected Year) ---
  const monthlyChartData = useMemo(() => {
    return monthNames.map((name, idx) => {
      const monthNum = idx + 1;
      const inc = incomes
        .filter((i) => {
          const [y, m] = (i.income_date || '').split('-').map(Number);
          return y === selectedYear && m === monthNum;
        })
        .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

      const exp = expenses
        .filter((e) => {
          const [y, m] = (e.expense_date || '').split('-').map(Number);
          return y === selectedYear && m === monthNum;
        })
        .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

      return {
        month: name.slice(0, 3),
        fullMonth: name,
        income: inc,
        expense: exp,
        net: inc - exp,
      };
    });
  }, [incomes, expenses, selectedYear]);

  const maxChartValue = useMemo(() => {
    const max = Math.max(
      ...monthlyChartData.map((d) => Math.max(d.income, d.expense)),
      100000
    );
    return max;
  }, [monthlyChartData]);

  // --- EXPENSE CATEGORY DISTRIBUTION BREAKDOWN ---
  const categoryBreakdown = useMemo(() => {
    const map = {};
    filteredExpenses.forEach((e) => {
      let cat = e.category || 'Lainnya';
      if (!cat || cat === 'Lainnya') {
        // Try extracting from description [Kategori]
        const match = (e.description || '').match(/^\[(.*?)\]/);
        if (match) cat = match[1];
      }
      if (!map[cat]) map[cat] = 0;
      map[cat] += Number(e.amount || 0);
    });

    return Object.entries(map)
      .map(([name, val]) => ({
        category: name,
        amount: val,
        percentage: totalExpense > 0 ? Math.round((val / totalExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalExpense]);

  // Combined Transactions List
  const combinedTransactions = useMemo(() => {
    const list = [
      ...filteredIncomes.map((i) => ({ ...i, type: 'income', date: i.income_date })),
      ...filteredExpenses.map((e) => ({ ...e, type: 'expense', date: e.expense_date })),
    ];
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredIncomes, filteredExpenses]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat Personal Finance...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#090d16] bg-ambient-grid text-slate-100 selection:bg-emerald-500 selection:text-black pb-24">
      {/* Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-subtle" />
      <div className="fixed bottom-20 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <Navbar />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl border transition-all animate-fade-in ${
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
        {/* Header & Filter Controls */}
        <header className="glass-panel rounded-3xl p-6 sm:p-8 shadow-glass flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 text-xl font-bold shadow-glow-emerald">
                📈
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Personal Finance & Cashflow
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Rekap income & outcome harian, bulanan, tahunan dengan visualisasi grafik lengkap
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Selector & Date Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Timeframe Tabs */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              {['daily', 'monthly', 'yearly'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                    timeframe === t
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'daily' ? 'Harian' : t === 'monthly' ? 'Bulanan' : 'Tahunan'}
                </button>
              ))}
            </div>

            {/* Context Pickers */}
            {timeframe === 'daily' && (
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="glass-input px-3 py-1.5 rounded-xl text-xs font-mono text-slate-200 bg-slate-900"
              />
            )}

            {timeframe === 'monthly' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="glass-input px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-slate-900"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="glass-input px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-slate-900"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {timeframe === 'yearly' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="glass-input px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-slate-900"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    Tahun {y}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* --- 4 STATS SUMMARY CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Total Income */}
          <div className="glass-panel rounded-2xl p-5 border border-emerald-500/20 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-emerald-400">Total Pemasukan</span>
              <span className="text-lg">📈</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              Rp {totalIncome.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500">{filteredIncomes.length} transaksi pemasukan</p>
          </div>

          {/* Total Expense */}
          <div className="glass-panel rounded-2xl p-5 border border-rose-500/20 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-rose-400">Total Pengeluaran</span>
              <span className="text-lg">💸</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-400 font-mono">
              Rp {totalExpense.toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500">{filteredExpenses.length} transaksi pengeluaran</p>
          </div>

          {/* Net Cashflow */}
          <div className={`glass-panel rounded-2xl p-5 border space-y-1 relative overflow-hidden ${
            netSavings >= 0 ? 'border-indigo-500/30' : 'border-amber-500/30'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-indigo-300">Saldo Bersih (Net)</span>
              <span className="text-lg">💰</span>
            </div>
            <p className={`text-2xl sm:text-3xl font-black font-mono ${
              netSavings >= 0 ? 'text-indigo-400' : 'text-amber-400'
            }`}>
              {netSavings < 0 ? '-' : '+'}Rp {Math.abs(netSavings).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-500">
              {netSavings >= 0 ? 'Surplus / Menabung' : 'Defisit (Pengeluaran > Pemasukan)'}
            </p>
          </div>

          {/* Savings Rate */}
          <div className="glass-panel rounded-2xl p-5 border border-purple-500/20 space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-purple-300">Savings Rate</span>
              <span className="text-lg">🎯</span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-purple-400">
              {savingsRate}%
            </p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(savingsRate, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* --- 2 CHARTS VISUALIZATION ROW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Cashflow Bar Chart (2 Cols) */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 lg:col-span-2 shadow-glass">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📊 Grafik Perbandingan Cashflow Bulanan ({selectedYear})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Perbandingan Pemasukan (Hijau) vs Pengeluaran (Merah) per bulan
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Income
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expense
                </span>
              </div>
            </div>

            {/* Custom Interactive Dark Bar Chart */}
            <div className="pt-6 pb-2 grid grid-cols-12 gap-1.5 sm:gap-3 items-end min-h-[240px] border-b border-slate-800">
              {monthlyChartData.map((d, idx) => {
                const incomeHeight = maxChartValue > 0 ? (d.income / maxChartValue) * 160 : 0;
                const expenseHeight = maxChartValue > 0 ? (d.expense / maxChartValue) * 160 : 0;

                return (
                  <div key={d.month} className="flex flex-col items-center gap-2 group relative">
                    {/* Hover Tooltip */}
                    <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none bg-slate-900/95 border border-slate-700 p-2 rounded-xl shadow-xl text-[10px] whitespace-nowrap space-y-0.5">
                      <p className="font-bold text-white">{d.fullMonth}</p>
                      <p className="text-emerald-400">+Rp {d.income.toLocaleString('id-ID')}</p>
                      <p className="text-rose-400">-Rp {d.expense.toLocaleString('id-ID')}</p>
                    </div>

                    {/* Bars Container */}
                    <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center h-[160px]">
                      {/* Income Bar */}
                      <div
                        className="w-2 sm:w-3 bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all duration-500 hover:brightness-125"
                        style={{ height: `${Math.max(incomeHeight, 2)}px` }}
                      />
                      {/* Expense Bar */}
                      <div
                        className="w-2 sm:w-3 bg-gradient-to-t from-rose-600 to-amber-500 rounded-t-md transition-all duration-500 hover:brightness-125"
                        style={{ height: `${Math.max(expenseHeight, 2)}px` }}
                      />
                    </div>

                    {/* Month Label */}
                    <span className={`text-[10px] sm:text-xs font-semibold ${
                      idx === selectedMonth ? 'text-emerald-400 font-bold' : 'text-slate-500'
                    }`}>
                      {d.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Breakdown (1 Col) */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 shadow-glass">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🍩 Kategori Pengeluaran</span>
              </h3>
              <p className="text-xs text-slate-400">
                Distribusi pengeluaran berdasarkan pos anggaran
              </p>
            </div>

            <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
              {categoryBreakdown.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Belum ada transaksi pengeluaran di periode ini.
                </div>
              ) : (
                categoryBreakdown.map((c) => (
                  <div key={c.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{c.category}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400">Rp {c.amount.toLocaleString('id-ID')}</span>
                        <span className="font-bold text-rose-400">{c.percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-rose-500 to-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* --- FORM & TRANSACTIONS TABLE ROW --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form Input Transaksi (1 Col) */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 shadow-glass">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>+ Catat Transaksi Baru</span>
              </h3>
              <p className="text-xs text-slate-400">
                Input pemasukan atau pengeluaran keuangan Anda
              </p>
            </div>

            {/* Type Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setTrxType('income');
                  setCategory('Gaji');
                }}
                className={`py-2 rounded-lg transition-all ${
                  trxType === 'income'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📈 Pemasukan (Income)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrxType('expense');
                  setCategory('Makan');
                }}
                className={`py-2 rounded-lg transition-all ${
                  trxType === 'expense'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💸 Pengeluaran (Outcome)
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              {/* Category Pills */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Pilih Kategori</label>
                <div className="flex flex-wrap gap-1.5">
                  {(trxType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        category === cat
                          ? trxType === 'income'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Nominal Transaksi (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    placeholder="Contoh: 50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="glass-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-mono text-white placeholder:text-slate-500"
                    required
                  />
                </div>
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Keterangan / Catatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Gaji Pokok, Nasi Padang, Bensin"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-slate-500"
                  required
                />
              </div>

              {/* Date Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Tanggal Transaksi</label>
                <input
                  type="date"
                  value={trxDate}
                  onChange={(e) => setTrxDate(e.target.value)}
                  className="glass-input w-full px-4 py-2 rounded-xl text-xs font-mono text-white bg-slate-900"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !amount || !description.trim()}
                className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-98 disabled:opacity-40 ${
                  trxType === 'income'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 shadow-glow-emerald'
                    : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 shadow-glow-amber'
                }`}
              >
                {submitting ? 'Menyimpan...' : `+ Simpan ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
              </button>
            </form>
          </div>

          {/* Transactions History Table (2 Cols) */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-5 lg:col-span-2 shadow-glass">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📜 Rincian Riwayat Transaksi</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                    {combinedTransactions.length} Transaksi
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar seluruh arus kas masuk & keluar pada periode terpilih
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/90 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Tanggal</th>
                    <th className="py-3.5 px-4">Tipe & Kategori</th>
                    <th className="py-3.5 px-4">Keterangan</th>
                    <th className="py-3.5 px-4 text-right">Nominal</th>
                    <th className="py-3.5 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {combinedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 text-xs">
                        Belum ada transaksi tercatat di periode ini.
                      </td>
                    </tr>
                  ) : (
                    combinedTransactions.map((trx) => {
                      const isInc = trx.type === 'income';
                      return (
                        <tr key={`${trx.type}-${trx.id}`} className="hover:bg-slate-900/50 transition">
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-400">
                            {trx.date}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${
                                isInc
                                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                              }`}
                            >
                              {isInc ? '📈 Income' : '💸 Expense'} • {trx.category || 'Umum'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-200">
                            {trx.description}
                          </td>
                          <td
                            className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                              isInc ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isInc ? '+' : '-'}Rp {Number(trx.amount || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => deleteTransaction(trx.type, trx.id)}
                              title="Hapus Transaksi"
                              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
