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

  // Active View Tab: 'cashflow' | 'assets'
  const [activeFinanceTab, setActiveFinanceTab] = useState('cashflow');

  // ASSETS & SAVINGS STATE
  const [assets, setAssets] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetCategoryFilter, setAssetCategoryFilter] = useState('all');
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [quickUpdateAsset, setQuickUpdateAsset] = useState(null);
  const [quickUpdateVal, setQuickUpdateVal] = useState('');

  // Asset Form State
  const [assetName, setAssetName] = useState('');
  const [assetCategory, setAssetCategory] = useState('emas');
  const [assetAmount, setAssetAmount] = useState('');
  const [assetBuyAmount, setAssetBuyAmount] = useState('');
  const [assetQuantity, setAssetQuantity] = useState('');
  const [assetInstitution, setAssetInstitution] = useState('');
  const [assetNotes, setAssetNotes] = useState('');
  const [savingAsset, setSavingAsset] = useState(false);

  // Asset Categories Config
  const assetCategories = [
    { id: 'emas', label: 'Emas / Logam Mulia', icon: '🪙', color: 'text-amber-500', bg: 'bg-amber-500/15 border-amber-500/30' },
    { id: 'saham', label: 'Saham (BBCA, dll)', icon: '📈', color: 'text-blue-500', bg: 'bg-blue-500/15 border-blue-500/30' },
    { id: 'crypto', label: 'Kripto / Crypto', icon: '⚡', color: 'text-violet-500', bg: 'bg-violet-500/15 border-violet-500/30' },
    { id: 'tabungan', label: 'Tabungan & Kas', icon: '🏦', color: 'text-emerald-500', bg: 'bg-emerald-500/15 border-emerald-500/30' },
    { id: 'reksadana', label: 'Reksadana / Obligasi', icon: '📊', color: 'text-cyan-500', bg: 'bg-cyan-500/15 border-cyan-500/30' },
    { id: 'lainnya', label: 'Aset Fisik / Lainnya', icon: '🏢', color: 'text-stone-400', bg: 'bg-stone-500/15 border-stone-500/30' },
  ];

  // Preset Shortcuts for 1-Click Fill
  const assetPresets = [
    {
      label: 'Emas Antam',
      icon: '🪙',
      name: 'Emas Antam Logam Mulia',
      category: 'emas',
      quantity: '10 gram',
      institution: 'Brankas / Butik Antam',
      notes: 'Emas batangan bersertifikat LBMA',
    },
    {
      label: 'Saham BBCA',
      icon: '📈',
      name: 'BBCA (Bank Central Asia)',
      category: 'saham',
      quantity: '10 lot',
      institution: 'Ajaib / Indo Premier',
      notes: 'Saham bluechip perbankan',
    },
    {
      label: 'Bitcoin (BTC)',
      icon: '⚡',
      name: 'Bitcoin (BTC)',
      category: 'crypto',
      quantity: '0.02 BTC',
      institution: 'Indodax / Tokocrypto',
      notes: 'Aset digital cryptocurrency',
    },
    {
      label: 'Tabungan BCA',
      icon: '🏦',
      name: 'BCA Tabungan Tahapan',
      category: 'tabungan',
      quantity: '1 Rekening',
      institution: 'Bank Central Asia',
      notes: 'Rekening simpanan harian',
    },
    {
      label: 'Reksadana Bibit',
      icon: '📊',
      name: 'Reksadana Pasar Uang',
      category: 'reksadana',
      quantity: 'Portofolio Bibit',
      institution: 'Bibit / Bareksa',
      notes: 'Dana darurat likuid',
    },
  ];

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
      fetchAssetsData();

      const channel = supabase
        .channel(`finance-realtime-${user.phone_number}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, () => fetchFinanceData(false))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => fetchFinanceData(false))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => fetchAssetsData(false))
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

  async function fetchAssetsData(showLoader = true) {
    if (!user) return;
    if (showLoader) setAssetsLoading(true);

    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .or(`phone_number.eq.${user.phone_number},phone_number.is.null`)
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback to localStorage if table doesn't exist yet in Supabase
        const local = localStorage.getItem(`wasap_assets_${user.phone_number}`);
        if (local) {
          try {
            setAssets(JSON.parse(local));
          } catch (e) {}
        }
      } else if (data) {
        setAssets(data);
        localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(data));
      }
    } catch (err) {
      const local = localStorage.getItem(`wasap_assets_${user.phone_number}`);
      if (local) {
        try {
          setAssets(JSON.parse(local));
        } catch (e) {}
      }
    } finally {
      if (showLoader) setAssetsLoading(false);
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

  // Asset Management Helpers & CRUD
  function openNewAssetModal(preset = null) {
    setEditingAsset(null);
    if (preset) {
      setAssetName(preset.name || '');
      setAssetCategory(preset.category || 'emas');
      setAssetAmount('');
      setAssetBuyAmount('');
      setAssetQuantity(preset.quantity || '');
      setAssetInstitution(preset.institution || '');
      setAssetNotes(preset.notes || '');
    } else {
      setAssetName('');
      setAssetCategory('emas');
      setAssetAmount('');
      setAssetBuyAmount('');
      setAssetQuantity('');
      setAssetInstitution('');
      setAssetNotes('');
    }
    setIsAssetModalOpen(true);
  }

  function openEditAssetModal(asset) {
    setEditingAsset(asset);
    setAssetName(asset.name || '');
    setAssetCategory(asset.category || 'emas');
    setAssetAmount(asset.amount || '');
    setAssetBuyAmount(asset.buy_amount || '');
    setAssetQuantity(asset.quantity || '');
    setAssetInstitution(asset.institution || '');
    setAssetNotes(asset.notes || '');
    setIsAssetModalOpen(true);
  }

  function closeAssetModal() {
    setIsAssetModalOpen(false);
    setEditingAsset(null);
    setAssetName('');
    setAssetAmount('');
    setAssetBuyAmount('');
    setAssetQuantity('');
    setAssetInstitution('');
    setAssetNotes('');
  }

  async function handleSaveAsset(e) {
    if (e) e.preventDefault();
    if (!assetName.trim() || !assetAmount || !user) return;

    setSavingAsset(true);
    const numAmount = Math.abs(Number(assetAmount));
    const numBuyAmount = assetBuyAmount ? Math.abs(Number(assetBuyAmount)) : 0;
    const userPhone = user?.phone_number ? String(user.phone_number) : null;

    const payload = {
      name: assetName.trim(),
      category: assetCategory,
      amount: numAmount,
      buy_amount: numBuyAmount,
      quantity: assetQuantity.trim() || null,
      institution: assetInstitution.trim() || null,
      notes: assetNotes.trim() || null,
      phone_number: userPhone,
    };

    try {
      if (editingAsset) {
        // Update in Supabase
        const { error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingAsset.id);

        if (error) throw error;

        setAssets((prev) => {
          const updated = prev.map((a) => (a.id === editingAsset.id ? { ...a, ...payload } : a));
          localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
          return updated;
        });
        showToast(`✅ Aset "${payload.name}" berhasil diperbarui!`);
      } else {
        // Insert in Supabase
        const { data, error } = await supabase
          .from('assets')
          .insert([payload])
          .select();

        if (error) throw error;

        const newRecord = data && data[0] ? data[0] : { id: Date.now(), ...payload };
        setAssets((prev) => {
          const updated = [newRecord, ...prev];
          localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
          return updated;
        });
        showToast(`✅ Aset "${payload.name}" berhasil ditambahkan!`);
      }

      closeAssetModal();
      fetchAssetsData(false);
    } catch (err) {
      console.warn('Save asset supabase fallback to localStorage:', err);
      if (editingAsset) {
        setAssets((prev) => {
          const updated = prev.map((a) => (a.id === editingAsset.id ? { ...a, ...payload } : a));
          localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
          return updated;
        });
        showToast(`✅ Aset "${payload.name}" diperbarui (Tersimpan Lokal)!`);
      } else {
        const localRecord = { id: Date.now(), ...payload, created_at: new Date().toISOString() };
        setAssets((prev) => {
          const updated = [localRecord, ...prev];
          localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
          return updated;
        });
        showToast(`✅ Aset "${payload.name}" ditambahkan (Tersimpan Lokal)!`);
      }
      closeAssetModal();
    } finally {
      setSavingAsset(false);
    }
  }

  async function handleQuickUpdatePrice(e) {
    if (e) e.preventDefault();
    if (!quickUpdateAsset || !quickUpdateVal) return;

    const newAmount = Math.abs(Number(quickUpdateVal));
    const assetId = quickUpdateAsset.id;

    try {
      const { error } = await supabase
        .from('assets')
        .update({ amount: newAmount })
        .eq('id', assetId);

      if (error) throw error;

      setAssets((prev) => {
        const updated = prev.map((a) => (a.id === assetId ? { ...a, amount: newAmount } : a));
        localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
        return updated;
      });
      showToast(`✅ Nilai ${quickUpdateAsset.name} diperbarui ke Rp ${newAmount.toLocaleString('id-ID')}!`);
    } catch (err) {
      setAssets((prev) => {
        const updated = prev.map((a) => (a.id === assetId ? { ...a, amount: newAmount } : a));
        localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
        return updated;
      });
      showToast(`✅ Nilai ${quickUpdateAsset.name} diperbarui!`);
    } finally {
      setQuickUpdateAsset(null);
      setQuickUpdateVal('');
    }
  }

  async function handleDeleteAsset(id) {
    if (!window.confirm('Yakin ingin menghapus aset ini dari portofolio?')) return;
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      setAssets((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
        return updated;
      });
      showToast('Aset berhasil dihapus dari portofolio');
    } catch (err) {
      setAssets((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        localStorage.setItem(`wasap_assets_${user.phone_number}`, JSON.stringify(updated));
        return updated;
      });
      showToast('Aset dihapus');
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
        assets,
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

  // Assets Computations & KPIs
  const totalAssetValue = useMemo(() => {
    return assets.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [assets]);

  const totalAssetCost = useMemo(() => {
    return assets.reduce((sum, a) => sum + Number(a.buy_amount || 0), 0);
  }, [assets]);

  const totalAssetProfit = totalAssetValue - totalAssetCost;
  const assetReturnRate = totalAssetCost > 0 ? ((totalAssetProfit / totalAssetCost) * 100).toFixed(1) : 0;
  const netWorth = netSavings + totalAssetValue;

  // Category breakdown stats for visual progress
  const assetCategoryStats = useMemo(() => {
    const stats = {};
    assets.forEach((a) => {
      const cat = (a.category || 'lainnya').toLowerCase();
      stats[cat] = (stats[cat] || 0) + Number(a.amount || 0);
    });
    return stats;
  }, [assets]);

  // Largest asset item
  const largestAsset = useMemo(() => {
    if (assets.length === 0) return null;
    return [...assets].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  }, [assets]);

  // Filtered Assets list
  const displayedAssets = useMemo(() => {
    return assets.filter((a) => {
      if (assetCategoryFilter !== 'all' && (a.category || '').toLowerCase() !== assetCategoryFilter) {
        return false;
      }
      if (!assetSearchTerm.trim()) return true;
      const lower = assetSearchTerm.toLowerCase();
      const name = (a.name || '').toLowerCase();
      const inst = (a.institution || '').toLowerCase();
      const notes = (a.notes || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return name.includes(lower) || inst.includes(lower) || notes.includes(lower) || cat.includes(lower);
    });
  }, [assets, assetCategoryFilter, assetSearchTerm]);

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
                        6 Sheets • Portofolio Aset • KPI Card • Grafik Arus Kas FP&A • Saldo Berjalan
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

        {/* Net Worth & Portofolio Overview Banner */}
        <div className="app-card p-5 sm:p-6 bg-gradient-to-r from-[#13426f]/15 via-[#0284c7]/10 to-amber-500/10 border border-[#0284c7]/20 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#13426f] via-[#0284c7] to-amber-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-sky-500/20">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                  Total Estimasi Kekayaan (Net Worth)
                </span>
                <span className="text-[9px] bg-[#0284c7]/15 text-[#0284c7] border border-[#0284c7]/30 px-2 py-0.5 rounded-full font-bold">
                  Kas + Aset
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-[var(--text-title)] tracking-tight">
                Rp {netWorth.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="bg-[var(--bg-card)]/90 backdrop-blur px-4 py-2 rounded-2xl border border-[var(--border-color)] space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Saldo Kas Arus Transaksi</span>
              <span className={`font-mono font-bold text-sm ${netSavings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netSavings < 0 ? '-' : '+'}Rp {Math.abs(netSavings).toLocaleString('id-ID')}
              </span>
            </div>

            <div className="bg-[var(--bg-card)]/90 backdrop-blur px-4 py-2 rounded-2xl border border-[var(--border-color)] space-y-0.5">
              <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Total Portofolio Aset ({assets.length} item)</span>
              <span className="font-mono font-bold text-sm text-amber-500">
                Rp {totalAssetValue.toLocaleString('id-ID')}
              </span>
            </div>

            {totalAssetProfit !== 0 && (
              <div className="bg-[var(--bg-card)]/90 backdrop-blur px-4 py-2 rounded-2xl border border-[var(--border-color)] space-y-0.5">
                <span className="text-[10px] text-[var(--text-muted)] block font-semibold">Keuntungan (Floating PnL)</span>
                <span className={`font-mono font-bold text-sm ${totalAssetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totalAssetProfit >= 0 ? '+' : ''}Rp {totalAssetProfit.toLocaleString('id-ID')}
                  {totalAssetCost > 0 && ` (${totalAssetProfit >= 0 ? '+' : ''}${assetReturnRate}%)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View Switcher: Arus Kas vs Aset & Tabungan */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-sm">
            <button
              type="button"
              onClick={() => setActiveFinanceTab('cashflow')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                activeFinanceTab === 'cashflow'
                  ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-md shadow-sky-500/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <span>📊</span>
              <span>Arus Kas & Transaksi</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeFinanceTab === 'cashflow' ? 'bg-white/20 text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              }`}>
                {combinedTransactions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFinanceTab('assets')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                activeFinanceTab === 'assets'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subtle)]'
              }`}
            >
              <span>💎</span>
              <span>Aset & Tabungan</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeFinanceTab === 'assets' ? 'bg-white/20 text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              }`}>
                {assets.length}
              </span>
            </button>
          </div>

          {activeFinanceTab === 'assets' && (
            <button
              type="button"
              onClick={() => openNewAssetModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              <span>+</span>
              <span>Tambah Aset / Tabungan</span>
            </button>
          )}
        </div>

        {activeFinanceTab === 'cashflow' ? (
          <>
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
          </>
        ) : (
          /* ========================================================= */
          /* PORTOFOLIO ASET & TABUNGAN (EMAS, CRYPTO, SAHAM BBCA, DLL) */
          /* ========================================================= */
          <div className="space-y-6 animate-fade-in">
            {/* Quick 1-Click Preset Template Bar */}
            <div className="app-card p-4 sm:p-5 bg-[var(--bg-card)] border border-[var(--border-color)] flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>1-Klik Tambah Cepat Aset Populer</span>
                </span>
                <p className="text-xs text-[var(--text-muted)]">
                  Klik untuk otomatis mengisi formulir aset seperti Emas, BBCA, Bitcoin, atau Tabungan:
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {assetPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => openNewAssetModal(preset)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--bg-subtle)] hover:bg-amber-500/15 text-[var(--text-main)] hover:text-amber-500 border border-[var(--border-color)] hover:border-amber-500/30 transition shadow-sm active:scale-95"
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4 Asset KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="app-card p-5 space-y-1 bg-gradient-to-br from-[var(--bg-card)] to-amber-500/5 border border-amber-500/20">
                <span className="text-xs font-bold uppercase text-amber-500 flex items-center gap-1.5">
                  <span>💎</span>
                  <span>Total Nilai Portofolio</span>
                </span>
                <p className="text-2xl font-black font-mono text-amber-500">
                  Rp {totalAssetValue.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{assets.length} aset terdaftar</p>
              </div>

              <div className="app-card p-5 space-y-1">
                <span className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1.5">
                  <span>💼</span>
                  <span>Total Modal Awal</span>
                </span>
                <p className="text-2xl font-black font-mono text-[var(--text-title)]">
                  Rp {totalAssetCost.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">Biaya perolehan investasi</p>
              </div>

              <div className="app-card p-5 space-y-1">
                <span className="text-xs font-bold uppercase flex items-center gap-1.5 text-[var(--text-title)]">
                  <span>🚀</span>
                  <span>Keuntungan (PnL)</span>
                </span>
                <p className={`text-2xl font-black font-mono ${
                  totalAssetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {totalAssetProfit < 0 ? '-' : '+'}Rp {Math.abs(totalAssetProfit).toLocaleString('id-ID')}
                </p>
                <p className={`text-[11px] font-bold ${totalAssetProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {totalAssetCost > 0 ? (totalAssetProfit >= 0 ? `+${assetReturnRate}% (Surplus)` : `${assetReturnRate}% (Minus)`) : 'Modal belum dicatat'}
                </p>
              </div>

              <div className="app-card p-5 space-y-1">
                <span className="text-xs font-bold uppercase text-[#2e96ff] flex items-center gap-1.5">
                  <span>🏆</span>
                  <span>Aset Terbesar</span>
                </span>
                <p className="text-lg font-black truncate text-[var(--text-title)]" title={largestAsset?.name || '-'}>
                  {largestAsset ? largestAsset.name : '-'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {largestAsset ? `Rp ${Number(largestAsset.amount || 0).toLocaleString('id-ID')} (${totalAssetValue > 0 ? ((Number(largestAsset.amount) / totalAssetValue) * 100).toFixed(0) : 0}%)` : 'Belum ada aset'}
                </p>
              </div>
            </div>

            {/* Visual Allocation Breakdown Bar */}
            {totalAssetValue > 0 && (
              <div className="app-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                    <span>📊</span>
                    <span>Distribusi Alokasi Portofolio</span>
                  </h3>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    100% dari Rp {totalAssetValue.toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-[var(--bg-subtle)] overflow-hidden flex shadow-inner">
                  {assetCategories.map((cat) => {
                    const catVal = assetCategoryStats[cat.id] || 0;
                    if (catVal <= 0) return null;
                    const pct = (catVal / totalAssetValue) * 100;
                    const bgColors = {
                      emas: 'bg-amber-500',
                      saham: 'bg-blue-500',
                      crypto: 'bg-violet-500',
                      tabungan: 'bg-emerald-500',
                      reksadana: 'bg-cyan-500',
                      lainnya: 'bg-stone-400',
                    };
                    return (
                      <div
                        key={cat.id}
                        style={{ width: `${pct}%` }}
                        className={`${bgColors[cat.id] || 'bg-sky-500'} h-full transition-all duration-500`}
                        title={`${cat.label}: ${pct.toFixed(1)}% (Rp ${catVal.toLocaleString('id-ID')})`}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-[11px]">
                  {assetCategories.map((cat) => {
                    const catVal = assetCategoryStats[cat.id] || 0;
                    if (catVal <= 0) return null;
                    const pct = ((catVal / totalAssetValue) * 100).toFixed(1);
                    return (
                      <div key={cat.id} className="flex items-center gap-1.5 font-bold">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          cat.id === 'emas' ? 'bg-amber-500' :
                          cat.id === 'saham' ? 'bg-blue-500' :
                          cat.id === 'crypto' ? 'bg-violet-500' :
                          cat.id === 'tabungan' ? 'bg-emerald-500' :
                          cat.id === 'reksadana' ? 'bg-cyan-500' : 'bg-stone-400'
                        }`} />
                        <span className="text-[var(--text-main)]">{cat.icon} {cat.label}:</span>
                        <span className="font-mono text-[var(--text-title)]">{pct}%</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">(Rp {catVal.toLocaleString('id-ID')})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter Pills & Search Bar */}
            <div className="app-card p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAssetCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                      assetCategoryFilter === 'all'
                        ? 'bg-[#13426f] dark:bg-[#0284c7] text-white shadow-sm'
                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Semua ({assets.length})
                  </button>

                  {assetCategories.map((cat) => {
                    const count = assets.filter((a) => (a.category || '').toLowerCase() === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAssetCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                          assetCategoryFilter === cat.id
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        {count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            assetCategoryFilter === cat.id ? 'bg-white/25 text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search Box */}
                <div className="relative w-full md:w-64">
                  <input
                    type="text"
                    placeholder="Cari aset / platform..."
                    value={assetSearchTerm}
                    onChange={(e) => setAssetSearchTerm(e.target.value)}
                    className="app-input w-full pl-8 pr-4 py-1.5 rounded-full text-xs"
                  />
                  <span className="absolute left-3 top-2 text-xs opacity-50">🔍</span>
                </div>
              </div>

              {/* Asset Cards Grid */}
              {displayedAssets.length === 0 ? (
                <div className="py-12 text-center text-[var(--text-muted)] space-y-4">
                  <p className="text-4xl">🪙</p>
                  <div className="space-y-1">
                    <p className="font-extrabold text-base text-[var(--text-title)]">
                      {assets.length === 0 ? 'Belum Ada Aset atau Tabungan' : 'Tidak Ditemukan Aset yang Sesuai'}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                      Mulai catat kekayaan Anda seperti Emas Antam, Saham BBCA, Cryptocurrency (Bitcoin), Tabungan BCA, atau Reksadana untuk melihat perkembangan portofolio.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => openNewAssetModal(assetPresets[0])}
                      className="px-3.5 py-1.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/25 transition"
                    >
                      🪙 + Emas Antam
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewAssetModal(assetPresets[1])}
                      className="px-3.5 py-1.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30 text-xs font-bold hover:bg-blue-500/25 transition"
                    >
                      📈 + Saham BBCA
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewAssetModal(assetPresets[2])}
                      className="px-3.5 py-1.5 rounded-full bg-violet-500/15 text-violet-500 border border-violet-500/30 text-xs font-bold hover:bg-violet-500/25 transition"
                    >
                      ⚡ + Bitcoin (BTC)
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewAssetModal(assetPresets[3])}
                      className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/25 transition"
                    >
                      🏦 + Tabungan BCA
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayedAssets.map((asset) => {
                    const currentVal = Number(asset.amount || 0);
                    const buyVal = Number(asset.buy_amount || 0);
                    const profitVal = currentVal - buyVal;
                    const profitPct = buyVal > 0 ? ((profitVal / buyVal) * 100).toFixed(1) : null;
                    const catObj = assetCategories.find((c) => c.id === (asset.category || '').toLowerCase()) || {
                      label: asset.category || 'Lainnya',
                      icon: '🏢',
                      color: 'text-stone-400',
                      bg: 'bg-stone-500/15 border-stone-500/30',
                    };

                    return (
                      <div
                        key={asset.id}
                        className="p-5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)] hover:border-amber-500/40 hover:shadow-lg transition space-y-3 relative group"
                      >
                        {/* Card Header: Category & Institution */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${catObj.bg} ${catObj.color}`}>
                            <span>{catObj.icon}</span>
                            <span>{catObj.label}</span>
                          </span>

                          {asset.institution && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] truncate max-w-[130px]">
                              {asset.institution}
                            </span>
                          )}
                        </div>

                        {/* Title & Quantity */}
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-sm text-[var(--text-title)] leading-snug">
                            {asset.name}
                          </h4>
                          {asset.quantity && (
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">
                              Kuantitas: <span className="font-bold text-[var(--text-main)]">{asset.quantity}</span>
                            </span>
                          )}
                        </div>

                        {/* Valuation & PnL */}
                        <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                              Nilai Terkini
                            </span>
                            <span className="text-base font-black font-mono text-amber-500">
                              Rp {currentVal.toLocaleString('id-ID')}
                            </span>
                          </div>

                          {buyVal > 0 && (
                            <div className="pt-1 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
                              <span className="text-[var(--text-muted)]">
                                Modal: <span className="font-mono">Rp {buyVal.toLocaleString('id-ID')}</span>
                              </span>
                              <span className={`font-mono font-bold ${profitVal >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {profitVal >= 0 ? '+' : ''}Rp {profitVal.toLocaleString('id-ID')} ({profitVal >= 0 ? '+' : ''}{profitPct}%)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Optional Notes */}
                        {asset.notes && (
                          <p className="text-[11px] text-[var(--text-muted)] italic line-clamp-2">
                            "{asset.notes}"
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickUpdateAsset(asset);
                              setQuickUpdateVal(String(asset.amount || ''));
                            }}
                            className="flex items-center gap-1 text-[11px] font-bold text-amber-500 hover:text-amber-400 p-1 rounded hover:bg-amber-500/10 transition"
                            title="Update nilai saat harga naik atau turun"
                          >
                            <span>⚡</span>
                            <span>Update Nilai</span>
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditAssetModal(asset)}
                              className="text-[11px] font-bold text-[var(--text-muted)] hover:text-[#0284c7] p-1 rounded hover:bg-[#0284c7]/10 transition"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="text-[11px] font-bold text-[var(--text-muted)] hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 transition"
                              title="Hapus aset"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: TAMBAH / EDIT ASET */}
        {isAssetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="app-card w-full max-w-lg p-6 rounded-3xl shadow-2xl border border-[var(--border-color)] space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div className="space-y-0.5">
                  <h3 className="text-base font-extrabold text-[var(--text-title)] flex items-center gap-2">
                    <span>{editingAsset ? '✏️' : '💎'}</span>
                    <span>{editingAsset ? 'Edit Aset / Tabungan' : 'Tambah Aset & Tabungan Baru'}</span>
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Contoh: Emas Antam, BBCA, Bitcoin, Rekening BCA, Bibit Reksadana
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeAssetModal}
                  className="text-lg text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-full hover:bg-[var(--bg-subtle)]"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAsset} className="space-y-3.5">
                {/* Category Selector Chips */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                    Pilih Kategori Aset
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {assetCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAssetCategory(cat.id)}
                        className={`px-2.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                          assetCategory === cat.id
                            ? 'bg-amber-500/20 text-amber-500 border-amber-500 shadow-sm'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-amber-500/40'
                        }`}
                      >
                        <span className="text-sm">{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nama Aset */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                    Nama Aset / Simpanan *
                  </label>
                  <input
                    type="text"
                    required
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="Contoh: BBCA (Bank Central Asia) / Emas Antam 10g / Bitcoin"
                    className="app-input w-full px-3.5 py-2 rounded-xl text-xs font-bold"
                  />
                </div>

                {/* Nilai Terkini & Modal Beli */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider pl-1">
                      Nilai Saat Ini (Rp) *
                    </label>
                    <input
                      type="number"
                      required
                      value={assetAmount}
                      onChange={(e) => setAssetAmount(e.target.value)}
                      placeholder="Contoh: 15000000"
                      className="app-input w-full px-3.5 py-2 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                      Modal Beli / Awal (Rp)
                    </label>
                    <input
                      type="number"
                      value={assetBuyAmount}
                      onChange={(e) => setAssetBuyAmount(e.target.value)}
                      placeholder="Opsional (untuk hitung cuan/rugi)"
                      className="app-input w-full px-3.5 py-2 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Kuantitas & Institusi/Tempat Simpan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                      Kuantitas / Satuan
                    </label>
                    <input
                      type="text"
                      value={assetQuantity}
                      onChange={(e) => setAssetQuantity(e.target.value)}
                      placeholder="Contoh: 10 lot / 10 gram / 0.05 BTC"
                      className="app-input w-full px-3.5 py-2 rounded-xl text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                      Platform / Tempat Simpan
                    </label>
                    <input
                      type="text"
                      value={assetInstitution}
                      onChange={(e) => setAssetInstitution(e.target.value)}
                      placeholder="Contoh: BCA / Ajaib / Indodax / Brankas"
                      className="app-input w-full px-3.5 py-2 rounded-xl text-xs"
                    />
                  </div>
                </div>

                {/* Catatan */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pl-1">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={assetNotes}
                    onChange={(e) => setAssetNotes(e.target.value)}
                    placeholder="Contoh: Tabungan gaji, investasi jangka panjang, dll"
                    className="app-input w-full px-3.5 py-2 rounded-xl text-xs"
                  />
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAssetModal}
                    className="px-4 py-2 rounded-full text-xs font-bold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingAsset || !assetName.trim() || !assetAmount}
                    className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/20 disabled:opacity-40 transition active:scale-95 flex items-center gap-2"
                  >
                    {savingAsset ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>{editingAsset ? 'Perbarui Aset' : '+ Simpan Aset'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: QUICK UPDATE HARGA PASAR */}
        {quickUpdateAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="app-card w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-[var(--border-color)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-extrabold text-[var(--text-title)] flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>Update Nilai Terkini</span>
                  </h3>
                  <p className="text-[11px] font-bold text-amber-500 truncate max-w-[200px]">
                    {quickUpdateAsset.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickUpdateAsset(null)}
                  className="text-base text-[var(--text-muted)] hover:text-[var(--text-main)] p-1"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-1">
                <div className="flex justify-between text-[var(--text-muted)]">
                  <span>Nilai Sebelumnya:</span>
                  <span className="font-mono font-bold">
                    Rp {Number(quickUpdateAsset.amount || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <form onSubmit={handleQuickUpdatePrice} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase pl-1">
                    Nilai Baru (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    autoFocus
                    value={quickUpdateVal}
                    onChange={(e) => setQuickUpdateVal(e.target.value)}
                    placeholder="Masukkan nilai pasar baru..."
                    className="app-input w-full px-3.5 py-2 rounded-xl text-sm font-mono font-bold"
                  />
                </div>

                {/* Quick percentage adjustment shortcuts */}
                <div className="flex items-center gap-1.5">
                  {[
                    { label: '+1%', mul: 1.01 },
                    { label: '+5%', mul: 1.05 },
                    { label: '+10%', mul: 1.1 },
                    { label: '-5%', mul: 0.95 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        const cur = Number(quickUpdateAsset.amount || 0);
                        if (cur > 0) {
                          setQuickUpdateVal(String(Math.round(cur * btn.mul)));
                        }
                      }}
                      className="flex-1 py-1 rounded-lg text-[10px] font-bold bg-[var(--bg-subtle)] hover:bg-amber-500/15 hover:text-amber-500 border border-[var(--border-color)] transition"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setQuickUpdateAsset(null)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--text-muted)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!quickUpdateVal}
                    className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-bold shadow-md shadow-amber-500/20 disabled:opacity-40 transition active:scale-95"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
