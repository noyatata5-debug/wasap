'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';
import { exportFinanceToExcel } from '../../lib/exportExcel';

export default function PersonalFinancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [timeframe, setTimeframe] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  const [trxType, setTrxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [trxDate, setTrxDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const incomeCategories = ['Gaji', 'Freelance', 'Bisnis', 'Investasi', 'Hadiah', 'Lainnya'];
  const expenseCategories = ['Makan', 'Transport', 'Belanja', 'Tagihan', 'Hiburan', 'Lainnya'];

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      const [{ data: incData }, { data: expData }] = await Promise.all([
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

      if (incData) setIncomes(incData);
      if (expData) setExpenses(expData);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  const handleExport = (exportType) => {
    setIsExportMenuOpen(false);
    try {
      exportFinanceToExcel({
        type: exportType,
        user,
        incomes,
        expenses,
        selectedYear,
        selectedMonth,
        monthNames,
      });
      showToast(`Laporan Excel (${exportType === 'monthly' ? 'Bulanan' : exportType === 'yearly' ? 'Tahunan' : 'Master'}) berhasil di-download! 📊`);
    } catch (err) {
      console.error(err);
      showToast('Gagal men-generate file Excel', 'error');
    }
  };

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
        showToast(`Pemasukan Rp ${numAmount.toLocaleString('id-ID')} dicatat!`);
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
        showToast(`Pengeluaran Rp ${numAmount.toLocaleString('id-ID')} dicatat!`);
      }

      setAmount('');
      setDescription('');
      fetchFinanceData(false);
    } catch (err) {
      showToast('Gagal menyimpan transaksi', 'error');
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
        setIncomes((prev) => prev.filter((i) => i.id !== id));
      } else {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
      showToast('Transaksi dihapus');
    } catch (err) {
      showToast('Gagal menghapus transaksi', 'error');
    }
  }

  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      const date = i.income_date;
      if (!date) return false;
      const [y, m] = date.split('-').map(Number);
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
      const [y, m] = date.split('-').map(Number);
      if (timeframe === 'daily') return date === selectedDateStr;
      if (timeframe === 'monthly') return y === selectedYear && m === selectedMonth + 1;
      if (timeframe === 'yearly') return y === selectedYear;
      return true;
    });
  }, [expenses, timeframe, selectedDateStr, selectedYear, selectedMonth]);

  const totalIncome = useMemo(() => filteredIncomes.reduce((s, i) => s + Number(i.amount || 0), 0), [filteredIncomes]);
  const totalExpense = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0), [filteredExpenses]);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

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
      };
    });
  }, [incomes, expenses, selectedYear]);

  const maxChartValue = useMemo(() => {
    return Math.max(...monthlyChartData.map((d) => Math.max(d.income, d.expense)), 100000);
  }, [monthlyChartData]);

  const combinedTransactions = useMemo(() => {
    const list = [
      ...filteredIncomes.map((i) => ({ ...i, type: 'income', date: i.income_date })),
      ...filteredExpenses.map((e) => ({ ...e, type: 'expense', date: e.expense_date })),
    ];
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredIncomes, filteredExpenses]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen app-canvas flex items-center justify-center text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat Finance...</span>
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
              Personal Finance
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Rekap pemasukan, pengeluaran, grafik arus kas & export Excel
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* EXPORT EXCEL DROPDOWN */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition active:scale-95"
              >
                <span>📊</span>
                <span>Export Excel</span>
                <span className="text-[10px] opacity-80">▼</span>
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 app-card shadow-2xl rounded-2xl p-2 z-50 animate-fade-in border border-[var(--border-color)]">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-color)] mb-1">
                    Pilih Format Periode Excel
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExport('monthly')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition"
                  >
                    <span className="text-base">📗</span>
                    <div>
                      <div>Laporan Bulanan</div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)]">
                        {monthNames[selectedMonth]} {selectedYear}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('yearly')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition"
                  >
                    <span className="text-base">📘</span>
                    <div>
                      <div>Laporan Tahunan</div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)]">
                        Tahun {selectedYear} (12 Bulan)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('all')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition"
                  >
                    <span className="text-base">📙</span>
                    <div>
                      <div>Semua Riwayat (Master)</div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)]">
                        Semua transaksi tercatat
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Filter Timeframe */}
            <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-full border border-[var(--border-color)] text-xs font-bold">
              {['daily', 'monthly', 'yearly'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1.5 rounded-full capitalize transition ${
                    timeframe === t
                      ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {t === 'daily' ? 'Harian' : t === 'monthly' ? 'Bulanan' : 'Tahunan'}
                </button>
              ))}
            </div>

            {timeframe === 'daily' && (
              <input
                type="date"
                value={selectedDateStr}
                onChange={(e) => setSelectedDateStr(e.target.value)}
                className="app-input px-3 py-1.5 rounded-full text-xs font-mono font-bold"
              />
            )}

            {timeframe === 'monthly' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="app-input px-3 py-1.5 rounded-full text-xs font-bold"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="app-input px-3 py-1.5 rounded-full text-xs font-bold"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="app-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-emerald-500">Pemasukan (Income)</span>
            <p className="text-2xl font-black font-mono text-[var(--text-title)]">Rp {totalIncome.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{filteredIncomes.length} transaksi</p>
          </div>

          <div className="app-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-rose-500">Pengeluaran (Expense)</span>
            <p className="text-2xl font-black font-mono text-rose-500">Rp {totalExpense.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-[var(--text-muted)]">{filteredExpenses.length} transaksi</p>
          </div>

          <div className="app-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-[var(--text-title)]">Saldo Bersih (Net)</span>
            <p className={`text-2xl font-black font-mono ${
              netSavings >= 0 ? 'text-emerald-500' : 'text-amber-500'
            }`}>
              {netSavings < 0 ? '-' : '+'}Rp {Math.abs(netSavings).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">{netSavings >= 0 ? 'Surplus Kas' : 'Defisit Arus Kas'}</p>
          </div>

          <div className="app-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-[#2e96ff]">Savings Rate</span>
            <p className="text-2xl font-black text-[#2e96ff]">{savingsRate}%</p>
            <div className="w-full bg-[var(--bg-subtle)] h-2 rounded-full overflow-hidden mt-2">
              <div className="bg-[#2e96ff] h-full rounded-full" style={{ width: `${Math.min(savingsRate, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Chart & Form Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Bar Chart */}
          <div className="app-card p-6 sm:p-7 space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--text-title)]">
                📊 Arus Kas Bulanan ({selectedYear})
              </h3>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-emerald-500">● Income</span>
                <span className="text-rose-500">● Expense</span>
              </div>
            </div>

            <div className="pt-6 pb-2 grid grid-cols-12 gap-2 items-end min-h-[220px] border-b border-[var(--border-color)]">
              {monthlyChartData.map((d, idx) => {
                const incHeight = maxChartValue > 0 ? (d.income / maxChartValue) * 140 : 0;
                const expHeight = maxChartValue > 0 ? (d.expense / maxChartValue) * 140 : 0;

                return (
                  <div key={d.month} className="flex flex-col items-center gap-2 group relative">
                    <div className="flex items-end gap-1 w-full justify-center h-[140px]">
                      <div className="w-2.5 bg-emerald-500 rounded-t-md" style={{ height: `${Math.max(incHeight, 2)}px` }} />
                      <div className="w-2.5 bg-rose-500 rounded-t-md" style={{ height: `${Math.max(expHeight, 2)}px` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${idx === selectedMonth ? 'text-[#2e96ff]' : 'text-[var(--text-muted)]'}`}>
                      {d.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Transaksi */}
          <div className="app-card p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[var(--text-title)]">+ Catat Transaksi</h3>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-subtle)] rounded-full border border-[var(--border-color)] text-xs font-bold">
              <button
                type="button"
                onClick={() => { setTrxType('income'); setCategory('Gaji'); }}
                className={`py-1.5 rounded-full transition ${
                  trxType === 'income'
                    ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                + Pemasukan
              </button>
              <button
                type="button"
                onClick={() => { setTrxType('expense'); setCategory('Makan'); }}
                className={`py-1.5 rounded-full transition ${
                  trxType === 'expense'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                - Pengeluaran
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(trxType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                      category === cat
                        ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <input
                type="number"
                placeholder="Nominal (Rp)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="app-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                required
              />

              <input
                type="text"
                placeholder="Keterangan transaksi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="app-input w-full px-4 py-2 rounded-full text-xs font-medium"
                required
              />

              <input
                type="date"
                value={trxDate}
                onChange={(e) => setTrxDate(e.target.value)}
                className="app-input w-full px-4 py-1.5 rounded-full text-xs font-mono font-bold"
                required
              />

              <button
                type="submit"
                disabled={submitting || !amount || !description.trim()}
                className="w-full py-2.5 app-btn-pop text-xs font-bold disabled:opacity-40"
              >
                {submitting ? 'Menyimpan...' : `+ Simpan ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="app-card p-6 sm:p-7 space-y-4">
          <h3 className="text-base font-extrabold text-[var(--text-title)]">
            📜 Riwayat Transaksi ({combinedTransactions.length})
          </h3>

          <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)]">
            <table className="w-full text-left text-xs text-[var(--text-main)]">
              <thead className="bg-[var(--bg-subtle)] text-[11px] font-bold text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {combinedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[var(--text-muted)]">
                      Belum ada transaksi di periode ini.
                    </td>
                  </tr>
                ) : (
                  combinedTransactions.map((trx) => {
                    const isInc = trx.type === 'income';
                    return (
                      <tr key={`${trx.type}-${trx.id}`} className="hover:bg-[var(--bg-subtle)] transition">
                        <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{trx.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isInc
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          }`}>
                            {trx.category || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[var(--text-main)]">{trx.description}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isInc ? '+' : '-'}Rp {Number(trx.amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteTransaction(trx.type, trx.id)}
                            className="text-[var(--text-muted)] hover:text-rose-500 font-bold p-1"
                          >
                            ✕
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
      </main>
    </div>
  );
}
