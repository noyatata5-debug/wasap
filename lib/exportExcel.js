import * as XLSX from 'xlsx';

export function exportFinanceToExcel({
  type = 'monthly', // 'monthly' | 'yearly' | 'all'
  user,
  incomes = [],
  expenses = [],
  selectedYear,
  selectedMonth,
  monthNames,
}) {
  const wb = XLSX.utils.book_new();
  const exportDateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let periodTitle = '';
  let filePrefix = '';

  if (type === 'monthly') {
    const monthName = monthNames[selectedMonth] || 'Bulan';
    periodTitle = `BULANAN (${monthName} ${selectedYear})`;
    filePrefix = `Laporan_Keuangan_Wasap_${monthName}_${selectedYear}`;
  } else if (type === 'yearly') {
    periodTitle = `TAHUNAN (Tahun ${selectedYear})`;
    filePrefix = `Laporan_Keuangan_Wasap_Tahunan_${selectedYear}`;
  } else {
    periodTitle = 'SEMUA PERIODE (MASTER)';
    filePrefix = `Laporan_Keuangan_Wasap_Semua_Periode`;
  }

  // Filter Data according to period
  const filteredIncomes = incomes.filter((i) => {
    if (!i.income_date) return false;
    const [y, m] = i.income_date.split('-').map(Number);
    if (type === 'monthly') return y === selectedYear && m === selectedMonth + 1;
    if (type === 'yearly') return y === selectedYear;
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (!e.expense_date) return false;
    const [y, m] = e.expense_date.split('-').map(Number);
    if (type === 'monthly') return y === selectedYear && m === selectedMonth + 1;
    if (type === 'yearly') return y === selectedYear;
    return true;
  });

  const totalInc = filteredIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const totalExp = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netCashflow = totalInc - totalExp;
  const savingsRate = totalInc > 0 ? Math.max(0, Math.round((netCashflow / totalInc) * 100)) : 0;

  // 1. SHEET 1: RINGKASAN & STATISTIK (SUMMARY)
  const summaryRows = [
    ['WASAP HUB — LAPORAN KEUANGAN PERSONAL'],
    ['========================================'],
    ['Periode Laporan', periodTitle],
    ['Nama Pengguna', `@${user?.username || 'User'}`],
    ['No. WhatsApp', `+${user?.phone_number || ''}`],
    ['Tanggal Export', exportDateStr],
    [''],
    ['RINGKASAN UTAMA ARUS KAS (KPI)', 'NOMINAL (IDR)'],
    ['Total Pemasukan (Total Income)', totalInc],
    ['Total Pengeluaran (Total Expense)', totalExp],
    ['Saldo Bersih (Net Cashflow)', netCashflow],
    ['Tingkat Tabungan (Savings Rate)', `${savingsRate}%`],
    ['Status Keuangan', netCashflow >= 0 ? 'Surplus / Sehat ✅' : 'Defisit / Waspada ⚠️'],
    [''],
  ];

  // Category Breakdown
  const expenseByCategory = {};
  filteredExpenses.forEach((e) => {
    const cat = e.category || 'Lainnya';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
  });

  summaryRows.push(['RINCIAN PENGELUARAN PER KATEGORI', 'TOTAL NOMINAL', 'PERSENTASE DARI TOTAL EXPENSE']);
  Object.keys(expenseByCategory).forEach((cat) => {
    const amt = expenseByCategory[cat];
    const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) + '%' : '0%';
    summaryRows.push([cat, amt, pct]);
  });
  summaryRows.push(['']);

  // If yearly or all, add monthly breakdown
  if (type === 'yearly' || type === 'all') {
    summaryRows.push(['REKAP BULANAN TAHUN ' + selectedYear, 'PEMASUKAN (RP)', 'PENGELUARAN (RP)', 'NETTO (RP)']);
    monthNames.forEach((mName, idx) => {
      const mNum = idx + 1;
      const mInc = incomes
        .filter((i) => {
          const [y, m] = (i.income_date || '').split('-').map(Number);
          return y === selectedYear && m === mNum;
        })
        .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

      const mExp = expenses
        .filter((e) => {
          const [y, m] = (e.expense_date || '').split('-').map(Number);
          return y === selectedYear && m === mNum;
        })
        .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

      summaryRows.push([mName, mInc, mExp, mInc - mExp]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 38 }, { wch: 25 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Laporan');

  // 2. SHEET 2: DAFTAR PEMASUKAN
  const incomeHeaders = ['No', 'Tanggal Pemasukan', 'Kategori', 'Keterangan', 'Nominal (Rp)'];
  const incomeDataRows = filteredIncomes.map((inc, idx) => [
    idx + 1,
    inc.income_date || '',
    inc.category || 'Gaji',
    inc.description ? inc.description.replace(/^\[.*?\]\s*/, '') : '',
    Number(inc.amount || 0),
  ]);
  incomeDataRows.push(['', '', '', 'TOTAL PEMASUKAN', totalInc]);

  const wsIncome = XLSX.utils.aoa_to_sheet([incomeHeaders, ...incomeDataRows]);
  wsIncome['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsIncome, 'Daftar Pemasukan');

  // 3. SHEET 3: DAFTAR PENGELUARAN
  const expenseHeaders = ['No', 'Tanggal Pengeluaran', 'Kategori', 'Keterangan', 'Nominal (Rp)'];
  const expenseDataRows = filteredExpenses.map((exp, idx) => [
    idx + 1,
    exp.expense_date || '',
    exp.category || 'Makan',
    exp.description ? exp.description.replace(/^\[.*?\]\s*/, '') : '',
    Number(exp.amount || 0),
  ]);
  expenseDataRows.push(['', '', '', 'TOTAL PENGELUARAN', totalExp]);

  const wsExpense = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseDataRows]);
  wsExpense['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsExpense, 'Daftar Pengeluaran');

  // 4. SHEET 4: SEMUA TRANSAKSI GABUNGAN (CHRONOLOGICAL)
  const combined = [
    ...filteredIncomes.map((i) => ({
      date: i.income_date,
      type: 'PEMASUKAN (INCOME)',
      category: i.category || 'Gaji',
      desc: i.description ? i.description.replace(/^\[.*?\]\s*/, '') : '',
      incomeAmt: Number(i.amount || 0),
      expenseAmt: 0,
    })),
    ...filteredExpenses.map((e) => ({
      date: e.expense_date,
      type: 'PENGELUARAN (EXPENSE)',
      category: e.category || 'Makan',
      desc: e.description ? e.description.replace(/^\[.*?\]\s*/, '') : '',
      incomeAmt: 0,
      expenseAmt: Number(e.amount || 0),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const allHeaders = ['No', 'Tanggal', 'Tipe Transaksi', 'Kategori', 'Keterangan', 'Pemasukan (+)', 'Pengeluaran (-)'];
  const allDataRows = combined.map((item, idx) => [
    idx + 1,
    item.date || '',
    item.type,
    item.category,
    item.desc,
    item.incomeAmt || 0,
    item.expenseAmt || 0,
  ]);
  allDataRows.push(['', '', '', '', 'TOTAL AKHIR', totalInc, totalExp]);

  const wsAll = XLSX.utils.aoa_to_sheet([allHeaders, ...allDataRows]);
  wsAll['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 26 }, { wch: 18 }, { wch: 38 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsAll, 'Semua Transaksi');

  // Trigger Download
  const fileName = `${filePrefix}_${new Date().getTime().toString().slice(-4)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
