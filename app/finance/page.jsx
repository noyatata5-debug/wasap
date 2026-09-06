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

  // Timeframe Mode: 'daily' | 'monthly' | 'yearly'
  const [timeframe, setTimeframe] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Form State
  const [trxType, setTrxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [trxDate, setTrxDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
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
        setIncomes(prev => prev.filter(i => i.id !== id));
      } else {
        setExpenses(prev => prev.filter(e => e.id !== id));
      }
      showToast('Transaksi dihapus');
    } catch (err) {
      showToast('Gagal menghapus transaksi', 'error');
    }
  }

  // Timeframe filtering
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
      <div className="min-h-screen bg-[#f9f7f0] flex items-center justify-center text-[#616c8a]">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-[#2e96ff] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Memuat Finance...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9f7f0] text-[#333333] pb-24">
      <Navbar />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-lg border transition-all animate-fade-in ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-[#13426f] text-white'
        }`}>
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* Header & Controls */}
        <div className="relief-card p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#13426f] tracking-tight">
              Personal Finance
            </h1>
            <p className="text-xs sm:text-sm text-[#616c8a]">
              Rekap pemasukan, pengeluaran & grafik arus kas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#f9f7f0] p-1 rounded-full border border-[#e7e5dc] text-xs font-bold">
              {['daily', 'monthly', 'yearly'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1.5 rounded-full capitalize transition ${
                    timeframe === t ? 'bg-[#13426f] text-white shadow-sm' : 'text-[#616c8a] hover:text-[#13426f]'
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
                className="relief-input px-3 py-1.5 rounded-full text-xs font-mono font-bold"
              />
            )}

            {timeframe === 'monthly' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="relief-input px-3 py-1.5 rounded-full text-xs font-bold"
                >
                  {monthNames.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="relief-input px-3 py-1.5 rounded-full text-xs font-bold"
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
          <div className="relief-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-emerald-600">Pemasukan (Income)</span>
            <p className="text-2xl font-black font-mono text-[#13426f]">Rp {totalIncome.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-[#616c8a]">{filteredIncomes.length} transaksi</p>
          </div>

          <div className="relief-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-rose-600">Pengeluaran (Expense)</span>
            <p className="text-2xl font-black font-mono text-rose-600">Rp {totalExpense.toLocaleString('id-ID')}</p>
            <p className="text-[11px] text-[#616c8a]">{filteredExpenses.length} transaksi</p>
          </div>

          <div className="relief-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-[#13426f]">Saldo Bersih (Net)</span>
            <p className={`text-2xl font-black font-mono ${netSavings >= 0 ? 'text-[#13426f]' : 'text-amber-600'}`}>
              {netSavings < 0 ? '-' : '+'}Rp {Math.abs(netSavings).toLocaleString('id-ID')}
            </p>
            <p className="text-[11px] text-[#616c8a]">{netSavings >= 0 ? 'Surplus Kas' : 'Defisit Arus Kas'}</p>
          </div>

          <div className="relief-card p-5 space-y-1">
            <span className="text-xs font-bold uppercase text-[#2e96ff]">Savings Rate</span>
            <p className="text-2xl font-black text-[#2e96ff]">{savingsRate}%</p>
            <div className="w-full bg-[#f1ede1] h-2 rounded-full overflow-hidden mt-2">
              <div className="bg-[#2e96ff] h-full rounded-full" style={{ width: `${Math.min(savingsRate, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Chart & Form Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Bar Chart */}
          <div className="relief-card p-6 sm:p-7 space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#13426f]">
                📊 Arus Kas Bulanan ({selectedYear})
              </h3>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-emerald-600">● Income</span>
                <span className="text-rose-600">● Expense</span>
              </div>
            </div>

            <div className="pt-6 pb-2 grid grid-cols-12 gap-2 items-end min-h-[220px] border-b border-[#e7e5dc]">
              {monthlyChartData.map((d, idx) => {
                const incHeight = maxChartValue > 0 ? (d.income / maxChartValue) * 140 : 0;
                const expHeight = maxChartValue > 0 ? (d.expense / maxChartValue) * 140 : 0;

                return (
                  <div key={d.month} className="flex flex-col items-center gap-2 group relative">
                    <div className="flex items-end gap-1 w-full justify-center h-[140px]">
                      <div className="w-2.5 bg-emerald-500 rounded-t-md" style={{ height: `${Math.max(incHeight, 2)}px` }} />
                      <div className="w-2.5 bg-rose-500 rounded-t-md" style={{ height: `${Math.max(expHeight, 2)}px` }} />
                    </div>
                    <span className={`text-[10px] font-bold ${idx === selectedMonth ? 'text-[#2e96ff]' : 'text-[#616c8a]'}`}>
                      {d.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Transaksi */}
          <div className="relief-card p-6 space-y-4">
            <h3 className="text-base font-extrabold text-[#13426f]">+ Catat Transaksi</h3>

            <div className="grid grid-cols-2 gap-1 p-1 bg-[#f9f7f0] rounded-full border border-[#e7e5dc] text-xs font-bold">
              <button
                type="button"
                onClick={() => { setTrxType('income'); setCategory('Gaji'); }}
                className={`py-1.5 rounded-full transition ${trxType === 'income' ? 'bg-[#13426f] text-white shadow-sm' : 'text-[#616c8a]'}`}
              >
                + Pemasukan
              </button>
              <button
                type="button"
                onClick={() => { setTrxType('expense'); setCategory('Makan'); }}
                className={`py-1.5 rounded-full transition ${trxType === 'expense' ? 'bg-rose-600 text-white shadow-sm' : 'text-[#616c8a]'}`}
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
                      category === cat ? 'bg-[#13426f] text-white shadow-sm' : 'bg-[#f9f7f0] text-[#616c8a]'
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
                className="relief-input w-full px-4 py-2 rounded-full text-xs font-mono font-bold"
                required
              />

              <input
                type="text"
                placeholder="Keterangan transaksi..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="relief-input w-full px-4 py-2 rounded-full text-xs font-medium"
                required
              />

              <input
                type="date"
                value={trxDate}
                onChange={(e) => setTrxDate(e.target.value)}
                className="relief-input w-full px-4 py-1.5 rounded-full text-xs font-mono font-bold"
                required
              />

              <button
                type="submit"
                disabled={submitting || !amount || !description.trim()}
                className="w-full py-2.5 relief-btn-pop text-xs font-bold disabled:opacity-40"
              >
                {submitting ? 'Menyimpan...' : `+ Simpan ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
              </button>
            </form>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="relief-card p-6 sm:p-7 space-y-4">
          <h3 className="text-base font-extrabold text-[#13426f]">
            📜 Riwayat Transaksi ({combinedTransactions.length})
          </h3>

          <div className="overflow-x-auto rounded-2xl border border-[#e7e5dc]">
            <table className="w-full text-left text-xs text-[#333333]">
              <thead className="bg-[#f9f7f0] text-[11px] font-bold text-[#616c8a] border-b border-[#e7e5dc]">
                <tr>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7e5dc]">
                {combinedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#616c8a]">
                      Belum ada transaksi di periode ini.
                    </td>
                  </tr>
                ) : (
                  combinedTransactions.map((trx) => {
                    const isInc = trx.type === 'income';
                    return (
                      <tr key={`${trx.type}-${trx.id}`} className="hover:bg-[#f9f7f0] transition">
                        <td className="py-3 px-4 font-mono text-[#616c8a]">{trx.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isInc ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {trx.category || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#212121]">{trx.description}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isInc ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isInc ? '+' : '-'}Rp {Number(trx.amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => deleteTransaction(trx.type, trx.id)}
                            className="text-[#616c8a] hover:text-rose-600 font-bold p-1"
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
