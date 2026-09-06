'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/authContext';
import { supabase } from '../../lib/supabase';
import Navbar from '../components/Navbar';
import { exportFinanceToExcel } from '../../lib/exportExcel';

// Helper to safely format any date input into YYYY-MM-DD
function formatToISODate(dateVal) {
  if (!dateVal) return new Date().toISOString().split('T')[0];
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// Helper to extract category whether from column or from tag [Kategori] in description
function getTransactionCategory(item, defaultCat = 'Lainnya') {
  if (item?.category && item.category !== 'Lainnya') return item.category;
  if (item?.description) {
    const match = item.description.match(/^\[(.*?)\]/);
    if (match && match[1]) return match[1];
  }
  return item?.category || defaultCat;
}

// Clean description by removing leading [Kategori] tag
function cleanDescription(desc) {
  if (!desc) return '';
  return desc.replace(/^\[.*?\]\s*/, '');
}

// Smart Parser for Bulk lines:
// Supports: "detail (spasi) nominal", "nominal (spasi) detail", "detail - nominal", tabs, k/rb/jt, etc.
function parseBulkLines(rawText, batchDate, defaultType, defaultCategory) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n');
  const items = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let desc = '';
    let amount = 0;
    let isValid = false;

    // Pattern 1: Number at the end -> "makan siang 35000" / "makan siang 35.000" / "kopi 18k"
    const endNumberMatch = trimmed.match(/^(.*?)[ \t\:\-]+([Rr][Pp]\.?\s*)?(\d[\d\.,]*)\s*([kK]|[rR][bB]|[jJ][tT]|[mM])?$/);
    // Pattern 2: Number at the beginning -> "35000 makan siang" / "35k kopi"
    const startNumberMatch = trimmed.match(/^([Rr][Pp]\.?\s*)?(\d[\d\.,]*)\s*([kK]|[rR][bB]|[jJ][tT]|[mM])?[ \t\:\-]+(.*)$/);

    if (endNumberMatch && endNumberMatch[3]) {
      desc = endNumberMatch[1].trim();
      const numStr = endNumberMatch[3].replace(/[.,]/g, '');
      const unit = (endNumberMatch[4] || '').toLowerCase();
      let parsedNum = parseFloat(numStr) || 0;
      if (unit === 'k' || unit === 'rb') parsedNum *= 1000;
      else if (unit === 'jt' || unit === 'm') parsedNum *= 1000000;
      amount = parsedNum;
      isValid = Boolean(desc && amount > 0);
    } else if (startNumberMatch && startNumberMatch[2]) {
      desc = startNumberMatch[4].trim();
      const numStr = startNumberMatch[2].replace(/[.,]/g, '');
      const unit = (startNumberMatch[3] || '').toLowerCase();
      let parsedNum = parseFloat(numStr) || 0;
      if (unit === 'k' || unit === 'rb') parsedNum *= 1000;
      else if (unit === 'jt' || unit === 'm') parsedNum *= 1000000;
      amount = parsedNum;
      isValid = Boolean(desc && amount > 0);
    } else {
      // Fallback: split by spaces, take last token as number if digits
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const numOnly = last.replace(/[^0-9]/g, '');
        if (numOnly && !isNaN(Number(numOnly))) {
          amount = Number(numOnly);
          desc = parts.slice(0, parts.length - 1).join(' ');
          isValid = Boolean(desc && amount > 0);
        }
      }
    }

    // Auto-detect category from description keywords
    let autoCat = defaultCategory;
    const lower = (desc || trimmed).toLowerCase();
    if (/makan|nasi|kopi|mie|sate|resto|kafe|sarapan|lunch|dinner|jajan|snack|minum|es\s|ayam|bakso|roti|burger|seblak|martabak|soto|warteg|ronda/.test(lower)) {
      autoCat = 'Makan';
    } else if (/bensin|pertamax|pertalite|solar|tol|parkir|grab|gojek|ojol|taksi|kereta|busway|mrt|angkot|cuci|servis|ban|oli/.test(lower)) {
      autoCat = 'Transport';
    } else if (/beli|belanja|baju|sepatu|shopee|tokped|tokopedia|lazada|tiktok|tas|kemeja|celana|kaos|skincare|makeup|sabun|odol|jaket|topup/.test(lower)) {
      autoCat = 'Belanja';
    } else if (/listrik|pln|air|pdam|wifi|indihome|pulsa|kuota|sewa|kontrakan|kos|bpjs|asuransi|cicilan|iuran|pajak/.test(lower)) {
      autoCat = 'Tagihan';
    } else if (/nonton|bioskop|cinema|game|steam|karaoke|liburan|hotel|staycation|wisata|party|healing|rekreasi/.test(lower)) {
      autoCat = 'Hiburan';
    } else if (/gaji|salary|upah|bonus|thr|payroll/.test(lower)) {
      autoCat = 'Gaji';
    } else if (/freelance|proyek|project|desain|web|coding|klien|jasa/.test(lower)) {
      autoCat = 'Freelance';
    } else if (/dividen|saham|crypto|reksadana|bunga|deposito|cuan/.test(lower)) {
      autoCat = 'Investasi';
    }

    items.push({
      id: idx,
      raw: trimmed,
      description: desc || trimmed,
      amount: amount,
      category: autoCat,
      date: batchDate,
      type: defaultType,
      isValid: isValid,
    });
  });

  return items;
}

export default function PersonalFinancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Timeframe: 'monthly' | 'all' | 'daily' | 'yearly'
  const [timeframe, setTimeframe] = useState('monthly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  // Single Input Form State
  const [trxType, setTrxType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Makan');
  const [description, setDescription] = useState('');
  const [trxDate, setTrxDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Bulk Input Form State
  const [inputMode, setInputMode] = useState('single'); // 'single' | 'bulk'
  const [bulkText, setBulkText] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkType, setBulkType] = useState('expense');
  const [bulkCategory, setBulkCategory] = useState('Makan');
  const [savingBulk, setSavingBulk] = useState(false);

  // Search & Filter in Table
  const [searchTerm, setSearchTerm] = useState('');

  // Export State
  const [isExporting, setIsExporting] = useState(false);
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
    setTimeout(() => setToast(null), 3500);
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
      console.error('Fetch finance error:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  // Safe insert helper that works with or without 'category' column in DB
  async function insertTransactionItem({ type, amount, category, description, date }) {
    const safeDate = formatToISODate(date);
    const numAmount = Math.abs(Number(amount));
    const finalDesc = description.trim();
    const tableName = type === 'income' ? 'incomes' : 'expenses';
    const dateField = type === 'income' ? 'income_date' : 'expense_date';
    const userPhone = user?.phone_number ? String(user.phone_number) : null;

    const payloadWithCat = {
      amount: numAmount,
      category: category,
      description: `[${category}] ${finalDesc}`,
      [dateField]: safeDate,
    };
    if (userPhone) payloadWithCat.phone_number = userPhone;

    const payloadWithoutCat = {
      amount: numAmount,
      description: `[${category}] ${finalDesc}`,
      [dateField]: safeDate,
    };
    if (userPhone) payloadWithoutCat.phone_number = userPhone;

    let res = await supabase.from(tableName).insert([payloadWithCat]).select();
    if (res.error && (res.error.message?.includes('category') || res.error.code === '42703')) {
      res = await supabase.from(tableName).insert([payloadWithoutCat]).select();
    }
    if (res.error) throw res.error;
    return res.data;
  }

  // Handle single transaction submission
  async function handleAddTransaction(e) {
    e.preventDefault();
    if (!amount || !description.trim() || !user) return;

    setSubmitting(true);
    const safeDate = formatToISODate(trxDate);
    const numAmount = Math.abs(Number(amount));
    const [y, m] = safeDate.split('-').map(Number);

    try {
      await insertTransactionItem({
        type: trxType,
        amount: numAmount,
        category: category,
        description: description,
        date: safeDate,
      });

      // Clear form
      setAmount('');
      setDescription('');

      // Informative feedback
      if (timeframe === 'monthly' && (y !== selectedYear || m !== selectedMonth + 1)) {
        showToast(
          `✅ ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'} Rp ${numAmount.toLocaleString('id-ID')} dicatat untuk ${safeDate} (Bulan ${monthNames[m - 1]} ${y})!`
        );
      } else {
        showToast(`✅ ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'} Rp ${numAmount.toLocaleString('id-ID')} dicatat!`);
      }

      fetchFinanceData(false);
    } catch (err) {
      console.error('Save transaction error:', err);
      showToast(`Gagal: ${err.message || 'Gagal menyimpan transaksi'}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Bulk parser computation
  const parsedBulkItems = useMemo(() => {
    return parseBulkLines(bulkText, bulkDate, bulkType, bulkCategory);
  }, [bulkText, bulkDate, bulkType, bulkCategory]);

  const validBulkItems = useMemo(() => {
    return parsedBulkItems.filter((item) => item.isValid);
  }, [parsedBulkItems]);

  const totalBulkAmount = useMemo(() => {
    return validBulkItems.reduce((sum, item) => sum + item.amount, 0);
  }, [validBulkItems]);

  // Handle bulk save
  async function handleBulkSave() {
    if (validBulkItems.length === 0 || !user) return;
    setSavingBulk(true);
    let successCount = 0;
    let failedCount = 0;
    let lastError = null;

    try {
      for (const item of validBulkItems) {
        try {
          await insertTransactionItem({
            type: item.type,
            amount: item.amount,
            category: item.category,
            description: item.description,
            date: item.date,
          });
          successCount++;
        } catch (itemErr) {
          failedCount++;
          lastError = itemErr;
        }
      }

      if (successCount > 0) {
        showToast(
          `✅ ${successCount} transaksi berhasil disimpan sekaligus! Total: Rp ${totalBulkAmount.toLocaleString('id-ID')}`
        );
        setBulkText('');
        fetchFinanceData(false);
      }
      if (failedCount > 0) {
        showToast(`⚠️ ${failedCount} transaksi gagal: ${lastError?.message || ''}`, 'error');
      }
    } catch (err) {
      console.error('Bulk save error:', err);
      showToast(`Gagal menyimpan bulk: ${err.message}`, 'error');
    } finally {
      setSavingBulk(false);
    }
  }

  function fillBulkExample() {
    setBulkText(
`makan siang padang 35000
kopi susu gula aren 18000
bensin pertamax mobil 150000
parkir kantor 5000
beli kemeja kerja 120000
makan ronda malam 25000`
    );
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
      console.error('Delete error:', err);
      showToast('Gagal menghapus transaksi', 'error');
    }
  }

  const handleExport = async (exportType) => {
    setIsExportMenuOpen(false);
    setIsExporting(true);
    showToast('Mempersiapkan Template Excel Pro... ⏳');
    try {
      await exportFinanceToExcel({
        type: exportType,
        user,
        incomes,
        expenses,
        selectedYear,
        selectedMonth,
        monthNames,
      });
      const typeLabel = exportType === 'monthly' ? 'Bulanan' : exportType === 'yearly' ? 'Tahunan' : 'Master';
      showToast(`Laporan Excel Pro (${typeLabel}) berhasil di-download! 📊✨`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Gagal men-generate file Excel: ' + (err.message || ''), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtered Incomes and Expenses
  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      const date = i.income_date;
      if (!date) return true;
      if (timeframe === 'all') return true;
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
      if (!date) return true;
      if (timeframe === 'all') return true;
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

  // Filtered transactions by user search
  const displayedTransactions = useMemo(() => {
    if (!searchTerm.trim()) return combinedTransactions;
    const lower = searchTerm.toLowerCase();
    return combinedTransactions.filter((trx) => {
      const cat = getTransactionCategory(trx).toLowerCase();
      const desc = cleanDescription(trx.description).toLowerCase();
      const date = (trx.date || '').toLowerCase();
      return cat.includes(lower) || desc.includes(lower) || date.includes(lower);
    });
  }, [combinedTransactions, searchTerm]);

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
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3 rounded-full shadow-2xl border transition-all animate-fade-in ${
            toast.type === 'error'
              ? 'bg-rose-500/25 border-rose-500/40 text-rose-300'
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
              Rekap pemasukan, pengeluaran, grafik arus kas, bulk input & export Excel Pro
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* EXPORT EXCEL DROPDOWN */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold shadow-lg transition active:scale-95 ${
                  isExporting
                    ? 'bg-emerald-700/60 cursor-not-allowed opacity-80'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20 hover:shadow-emerald-500/30'
                }`}
              >
                {isExporting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Mengekspor...</span>
                  </>
                ) : (
                  <>
                    <span>📊</span>
                    <span>Export Excel Pro</span>
                    <span className="text-[9px] bg-emerald-700/60 px-1.5 py-0.5 rounded font-mono">PRO</span>
                    <span className="text-[10px] opacity-80">▼</span>
                  </>
                )}
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 app-card shadow-2xl rounded-2xl p-2.5 z-50 animate-fade-in border border-[var(--border-color)]">
                  <div className="px-3 py-2 border-b border-[var(--border-color)] mb-1.5 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-extrabold text-[var(--text-title)] tracking-tight">
                        EXCEL PRO TEMPLATE
                      </div>
                      <div className="text-[9px] text-[var(--text-muted)]">
                        5 Sheets • KPI Card • Bar Visual • Saldo Berjalan
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      PREMIUM
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExport('monthly')}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition">📗</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>Laporan Bulanan</span>
                        <span className="text-[9px] text-emerald-500 font-normal">Rekomendasi</span>
                      </div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)] leading-snug">
                        {monthNames[selectedMonth]} {selectedYear} (Dashboard, Harian & Buku Kas)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('yearly')}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition">📘</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>Laporan Tahunan</span>
                        <span className="text-[9px] text-blue-500 font-normal">12 Bulan</span>
                      </div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)] leading-snug">
                        Tahun {selectedYear} (Matriks 12 Bln & Analisis Kuartal)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('all')}
                    className="w-full flex items-start gap-2.5 px-3 py-2 text-xs font-bold text-left rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-main)] transition group"
                  >
                    <span className="text-xl group-hover:scale-110 transition">📙</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span>Master Semua Periode</span>
                        <span className="text-[9px] text-amber-500 font-normal">Lengkap</span>
                      </div>
                      <div className="text-[10px] font-normal text-[var(--text-muted)] leading-snug">
                        Seluruh transaksi dari awal dengan Saldo Berjalan
                      </div>
                    </div>
                  </button>

                  <div className="mt-2 pt-2 border-t border-[var(--border-color)] px-2 py-1 text-[9px] text-center text-[var(--text-muted)]">
                    ⚡ Format Excel profesional siap pakai & print-ready
                  </div>
                </div>
              )}
            </div>

            {/* Filter Timeframe Buttons */}
            <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-full border border-[var(--border-color)] text-xs font-bold">
              {[
                { id: 'all', label: 'Semua' },
                { id: 'monthly', label: 'Bulanan' },
                { id: 'daily', label: 'Harian' },
                { id: 'yearly', label: 'Tahunan' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTimeframe(t.id)}
                  className={`px-3 py-1.5 rounded-full capitalize transition ${
                    timeframe === t.id
                      ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {timeframe === 'all' && (
              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                🌐 Semua Masa (Master)
              </span>
            )}

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

            {timeframe === 'yearly' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="app-input px-3 py-1.5 rounded-full text-xs font-bold"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>Tahun {y}</option>
                ))}
              </select>
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

          {/* Form Transaksi (Single & Bulk) */}
          <div className="app-card p-6 space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <h3 className="text-base font-extrabold text-[var(--text-title)] flex items-center gap-2">
                <span>{inputMode === 'single' ? '✏️' : '⚡'}</span>
                <span>{inputMode === 'single' ? 'Catat Transaksi' : 'Bulk Input Massal'}</span>
              </h3>

              <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-full border border-[var(--border-color)] text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setInputMode('single')}
                  className={`px-3 py-1 rounded-full transition ${
                    inputMode === 'single'
                      ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  Satuan
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('bulk')}
                  className={`px-3 py-1 rounded-full transition flex items-center gap-1 ${
                    inputMode === 'bulk'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-emerald-500'
                  }`}
                >
                  <span>⚡ Bulk</span>
                  <span className="text-[9px] bg-white/20 px-1 rounded">Cepat</span>
                </button>
              </div>
            </div>

            {/* SINGLE INPUT MODE */}
            {inputMode === 'single' ? (
              <>
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

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-2">
                      Tanggal Transaksi (Bisa tanggal yang dulu)
                    </label>
                    <input
                      type="date"
                      value={trxDate}
                      onChange={(e) => setTrxDate(e.target.value)}
                      className="app-input w-full px-4 py-1.5 rounded-full text-xs font-mono font-bold"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !amount || !description.trim()}
                    className="w-full py-2.5 app-btn-pop text-xs font-bold disabled:opacity-40"
                  >
                    {submitting ? 'Menyimpan...' : `+ Simpan ${trxType === 'income' ? 'Pemasukan' : 'Pengeluaran'}`}
                  </button>
                </form>
              </>
            ) : (
              /* BULK INPUT MODE */
              <div className="space-y-3">
                {/* Bulk Date & Type Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase pl-1">
                      Pilih Tanggal
                    </label>
                    <input
                      type="date"
                      value={bulkDate}
                      onChange={(e) => setBulkDate(e.target.value)}
                      className="app-input w-full px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase pl-1">
                      Jenis Transaksi
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-color)] text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => { setBulkType('expense'); setBulkCategory('Makan'); }}
                        className={`py-1 rounded-lg transition ${
                          bulkType === 'expense'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        - Pengeluaran
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBulkType('income'); setBulkCategory('Gaji'); }}
                        className={`py-1 rounded-lg transition ${
                          bulkType === 'income'
                            ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        + Pemasukan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Default Category Chips */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase pl-1">
                      Kategori Default (Otomatis Deteksi Keyword)
                    </label>
                    <button
                      type="button"
                      onClick={fillBulkExample}
                      className="text-[10px] font-bold text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      📋 Isi Contoh
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(bulkType === 'income' ? incomeCategories : expenseCategories).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBulkCategory(cat)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                          bulkCategory === cat
                            ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Multi-line Textarea */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] px-1">
                    <span>Format: <code>"detail" (spasi) "pengeluaran"</code></span>
                    {bulkText && (
                      <button
                        type="button"
                        onClick={() => setBulkText('')}
                        className="text-rose-400 hover:underline font-bold"
                      >
                        🗑️ Bersihkan
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={5}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Ketik atau paste teks baris demi baris:\nmakan siang 35000\nkopi susu 18000\nbensin pertamax 50000\nparkir mall 5000\nbeli kemeja 150000\nmakan ronda 1000000`}
                    className="app-input w-full p-3 rounded-2xl text-xs font-mono leading-relaxed"
                  />
                </div>

                {/* Live Preview Summary */}
                {parsedBulkItems.length > 0 && (
                  <div className="space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-500">
                          ✅ {validBulkItems.length} valid
                        </span>
                        {parsedBulkItems.length > validBulkItems.length && (
                          <span className="text-rose-400 text-[11px]">
                            ⚠️ {parsedBulkItems.length - validBulkItems.length} format salah
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-black text-[var(--text-title)]">
                        Total: Rp {totalBulkAmount.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* Compact Live Preview Table */}
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[var(--bg-subtle)] sticky top-0 text-[10px] text-[var(--text-muted)] font-bold">
                          <tr>
                            <th className="py-1.5 px-2.5">#</th>
                            <th className="py-1.5 px-2.5">Detail</th>
                            <th className="py-1.5 px-2.5">Kategori</th>
                            <th className="py-1.5 px-2.5 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-color)]">
                          {parsedBulkItems.map((item, idx) => (
                            <tr key={idx} className={item.isValid ? '' : 'bg-rose-500/10'}>
                              <td className="py-1 px-2.5 font-mono text-[var(--text-muted)]">{idx + 1}</td>
                              <td className="py-1 px-2.5 font-medium truncate max-w-[120px]">
                                {item.description}
                              </td>
                              <td className="py-1 px-2.5">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                  {item.category}
                                </span>
                              </td>
                              <td className="py-1 px-2.5 text-right font-mono font-bold">
                                {item.isValid ? `Rp ${item.amount.toLocaleString('id-ID')}` : '⚠️ Salah format'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Bulk Submit Button */}
                <button
                  type="button"
                  disabled={savingBulk || validBulkItems.length === 0}
                  onClick={handleBulkSave}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-40 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  {savingBulk ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan {validBulkItems.length} Transaksi...</span>
                    </>
                  ) : (
                    <>
                      <span>⚡ Simpan Semua ({validBulkItems.length} Transaksi)</span>
                      {validBulkItems.length > 0 && (
                        <span className="font-mono opacity-90">— Rp {totalBulkAmount.toLocaleString('id-ID')}</span>
                      )}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-base font-extrabold text-[var(--text-title)] flex items-center gap-2">
                <span>📜 Riwayat Transaksi</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-muted)]">
                  {displayedTransactions.length} transaksi
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                {timeframe === 'all'
                  ? 'Menampilkan semua transaksi dari seluruh periode'
                  : timeframe === 'monthly'
                  ? `Menampilkan transaksi bulan ${monthNames[selectedMonth]} ${selectedYear}`
                  : timeframe === 'daily'
                  ? `Menampilkan transaksi tanggal ${selectedDateStr}`
                  : `Menampilkan transaksi tahun ${selectedYear}`}
              </p>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari transaksi / kategori..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="app-input w-full pl-8 pr-4 py-1.5 rounded-full text-xs"
              />
              <span className="absolute left-3 top-2 text-xs opacity-50">🔍</span>
            </div>
          </div>

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
                {displayedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[var(--text-muted)] space-y-2">
                      <p className="text-2xl">🍃</p>
                      <p className="font-semibold">Belum ada transaksi di filter ini.</p>
                      {timeframe !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setTimeframe('all')}
                          className="px-3.5 py-1.5 rounded-full bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 text-xs font-bold border border-emerald-500/20 transition"
                        >
                          Lihat Semua Transaksi (Masa Lalu & Sekarang) ➔
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedTransactions.map((trx) => {
                    const isInc = trx.type === 'income';
                    const categoryName = getTransactionCategory(trx);
                    const cleanDesc = cleanDescription(trx.description);

                    return (
                      <tr key={`${trx.type}-${trx.id}`} className="hover:bg-[var(--bg-subtle)] transition">
                        <td className="py-3 px-4 font-mono text-[var(--text-muted)]">{trx.date}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            isInc
                              ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                          }`}>
                            {categoryName}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[var(--text-main)]">{cleanDesc}</td>
                        <td className={`py-3 px-4 text-right font-mono font-bold ${isInc ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isInc ? '+' : '-'}Rp {Number(trx.amount || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => deleteTransaction(trx.type, trx.id)}
                            className="text-[var(--text-muted)] hover:text-rose-500 font-bold p-1 rounded hover:bg-rose-500/10 transition"
                            title="Hapus transaksi"
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
