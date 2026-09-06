import ExcelJS from 'exceljs';

/**
 * Helper untuk membuat visual data bar menggunakan karakter unicode block
 * Contoh: generateDataBar(0.65, 10) => "███████░░░"
 */
function generateDataBar(ratio, length = 12) {
  if (isNaN(ratio) || ratio <= 0) {
    return '░'.repeat(length);
  }
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const filledCount = Math.round(clamped * length);
  const emptyCount = Math.max(0, length - filledCount);
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

/**
 * Helper untuk membuat double comparative bar antara Pemasukan vs Pengeluaran
 * Contoh: generateCompareBar(inc, exp, 14) => "🟩████████|🟥████░"
 */
function generateCompareBar(income, expense, maxVal, length = 10) {
  if (!maxVal || maxVal <= 0) return '░'.repeat(length * 2);
  const incRatio = Math.min(Math.max(income / maxVal, 0), 1);
  const expRatio = Math.min(Math.max(expense / maxVal, 0), 1);
  const incBars = Math.round(incRatio * length);
  const expBars = Math.round(expRatio * length);
  return `🟩 ${'█'.repeat(incBars)}${'░'.repeat(Math.max(0, length - incBars))} | 🟥 ${'█'.repeat(expBars)}${'░'.repeat(Math.max(0, length - expBars))}`;
}

const INDO_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function getIndoDayName(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return INDO_DAYS[d.getDay()] || '-';
  } catch {
    return '-';
  }
}

function extractCategory(item, defaultCat = 'Lainnya') {
  if (item?.category && item.category !== 'Lainnya') return item.category;
  if (item?.description) {
    const match = item.description.match(/^\[(.*?)\]/);
    if (match && match[1]) return match[1];
  }
  return item?.category || defaultCat;
}

function cleanDescription(desc) {
  if (!desc) return '';
  return desc.replace(/^\[.*?\]\s*/, '');
}

// Styling Constants (Executive Finance Palette)
const THEME = {
  headerBg: '0F172A',       // Dark Slate Navy
  headerText: 'FFFFFF',     // White
  subHeaderBg: '1E293B',    // Slate Navy Lighter
  cardIncomeBg: 'D1FAE5',   // Soft Emerald
  cardIncomeText: '065F46', // Deep Emerald
  cardExpenseBg: 'FFE4E6',  // Soft Crimson
  cardExpenseText: '9F1239',// Deep Crimson
  cardNetBg: 'DBEAFE',      // Soft Blue
  cardNetText: '1E40AF',    // Deep Blue
  cardRateBg: 'FEF3C7',     // Soft Amber
  cardRateText: '92400E',   // Deep Amber
  tableHeaderBg: '1E293B',  // Slate Dark
  tableHeaderText: 'F8FAFC',
  zebraEvenBg: 'F8FAFC',    // Very light slate
  zebraOddBg: 'FFFFFF',     // White
  borderSoft: 'E2E8F0',     // Light slate border
  borderMedium: '94A3B8',   // Medium border
  fontFamily: 'Segoe UI',
};

const BORDER_STYLE_THIN = {
  top: { style: 'thin', color: { argb: THEME.borderSoft } },
  bottom: { style: 'thin', color: { argb: THEME.borderSoft } },
  left: { style: 'thin', color: { argb: THEME.borderSoft } },
  right: { style: 'thin', color: { argb: THEME.borderSoft } },
};

const BORDER_STYLE_TOTAL = {
  top: { style: 'thin', color: { argb: THEME.borderMedium } },
  bottom: { style: 'double', color: { argb: THEME.headerBg } },
  left: { style: 'thin', color: { argb: THEME.borderSoft } },
  right: { style: 'thin', color: { argb: THEME.borderSoft } },
};

const CURRENCY_FORMAT = '"Rp "#,##0;[Red]("-Rp "#,##0);"-"';
const PERCENT_FORMAT = '0.0%';

export async function exportFinanceToExcel({
  type = 'monthly', // 'monthly' | 'yearly' | 'all'
  user,
  incomes = [],
  expenses = [],
  selectedYear = new Date().getFullYear(),
  selectedMonth = new Date().getMonth(),
  monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ],
}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Wasap Hub Financial';
  wb.lastModifiedBy = user?.username ? `@${user.username}` : 'Wasap User';
  wb.created = new Date();
  wb.modified = new Date();

  const exportDateStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let periodTitle = '';
  let filePrefix = '';
  const currentMonthName = monthNames[selectedMonth] || 'Bulan';

  if (type === 'monthly') {
    periodTitle = `Laporan Keuangan Bulanan — ${currentMonthName} ${selectedYear}`;
    filePrefix = `Laporan_Keuangan_Wasap_${currentMonthName}_${selectedYear}`;
  } else if (type === 'yearly') {
    periodTitle = `Laporan Keuangan Tahunan — Tahun ${selectedYear}`;
    filePrefix = `Laporan_Keuangan_Wasap_Tahunan_${selectedYear}`;
  } else {
    periodTitle = `Laporan Keuangan Komprehensif — Semua Riwayat Transaksi`;
    filePrefix = `Laporan_Keuangan_Wasap_Master_Semua_Periode`;
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
  const savingsRate = totalInc > 0 ? (netCashflow / totalInc) : 0;
  const expenseRatio = totalInc > 0 ? (totalExp / totalInc) : (totalExp > 0 ? 1 : 0);

  // Status Keuangan
  let statusBadge = '🟢 Surplus Sangat Sehat (Ideal)';
  if (netCashflow < 0) {
    statusBadge = '🔴 Defisit (Pengeluaran Melebihi Pemasukan)';
  } else if (savingsRate < 0.2 && savingsRate >= 0) {
    statusBadge = '🟡 Waspada (Tingkat Tabungan < 20%)';
  } else if (savingsRate >= 0.2 && savingsRate < 0.4) {
    statusBadge = '🟢 Sehat (Tingkat Tabungan 20% - 40%)';
  }

  // -------------------------------------------------------------
  // SHEET 1: 📊 EXECUTIVE DASHBOARD
  // -------------------------------------------------------------
  const wsDash = wb.addWorksheet('📊 Dashboard Eksekutif', {
    properties: { tabColor: { argb: '10B981' } },
    views: [{ showGridLines: true }],
  });

  wsDash.columns = [
    { width: 4 },  // A (padding)
    { width: 22 }, // B
    { width: 20 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 22 }, // F
    { width: 22 }, // G
    { width: 18 }, // H
  ];

  // Hero Title Banner
  wsDash.mergeCells('B2:G2');
  const bannerTitle = wsDash.getCell('B2');
  bannerTitle.value = 'WASAP HUB — PERSONAL FINANCIAL DASHBOARD';
  bannerTitle.font = { name: THEME.fontFamily, size: 16, bold: true, color: { argb: THEME.headerText } };
  bannerTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  bannerTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDash.getRow(2).height = 42;

  // Banner Subtitle Info
  wsDash.mergeCells('B3:G3');
  const bannerSub = wsDash.getCell('B3');
  bannerSub.value = `Periode: ${periodTitle.toUpperCase()}  |  Akun: @${user?.username || 'User'} (+${user?.phone_number || '-'})  |  Diexport: ${exportDateStr}`;
  bannerSub.font = { name: THEME.fontFamily, size: 9.5, italic: true, color: { argb: 'CBD5E1' } };
  bannerSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subHeaderBg } };
  bannerSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDash.getRow(3).height = 24;

  // Space
  wsDash.getRow(4).height = 12;

  // KPI CARDS HEADER SECTION (Row 5 & 6)
  // Card 1: Total Pemasukan (B5:C6)
  wsDash.mergeCells('B5:C5');
  const card1Title = wsDash.getCell('B5');
  card1Title.value = 'TOTAL PEMASUKAN (INCOME)';
  card1Title.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.cardIncomeText } };
  card1Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardIncomeBg } };
  card1Title.alignment = { horizontal: 'center', vertical: 'middle' };

  wsDash.mergeCells('B6:C6');
  const card1Val = wsDash.getCell('B6');
  card1Val.value = totalInc;
  card1Val.numFmt = CURRENCY_FORMAT;
  card1Val.font = { name: THEME.fontFamily, size: 15, bold: true, color: { argb: THEME.cardIncomeText } };
  card1Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardIncomeBg } };
  card1Val.alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 2: Total Pengeluaran (D5:D6)
  const card2Title = wsDash.getCell('D5');
  card2Title.value = 'TOTAL PENGELUARAN';
  card2Title.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.cardExpenseText } };
  card2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardExpenseBg } };
  card2Title.alignment = { horizontal: 'center', vertical: 'middle' };

  const card2Val = wsDash.getCell('D6');
  card2Val.value = totalExp;
  card2Val.numFmt = CURRENCY_FORMAT;
  card2Val.font = { name: THEME.fontFamily, size: 15, bold: true, color: { argb: THEME.cardExpenseText } };
  card2Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardExpenseBg } };
  card2Val.alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 3: Saldo Bersih / Net Cashflow (E5:E6)
  const card3Title = wsDash.getCell('E5');
  card3Title.value = 'SALDO BERSIH (NETTO)';
  card3Title.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.cardNetText } };
  card3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardNetBg } };
  card3Title.alignment = { horizontal: 'center', vertical: 'middle' };

  const card3Val = wsDash.getCell('E6');
  card3Val.value = netCashflow;
  card3Val.numFmt = CURRENCY_FORMAT;
  card3Val.font = { name: THEME.fontFamily, size: 15, bold: true, color: { argb: netCashflow >= 0 ? THEME.cardNetText : THEME.cardExpenseText } };
  card3Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardNetBg } };
  card3Val.alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 4: Tingkat Tabungan / Savings Rate (F5:G6)
  wsDash.mergeCells('F5:G5');
  const card4Title = wsDash.getCell('F5');
  card4Title.value = 'TINGKAT TABUNGAN (SAVINGS RATE)';
  card4Title.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.cardRateText } };
  card4Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardRateBg } };
  card4Title.alignment = { horizontal: 'center', vertical: 'middle' };

  wsDash.mergeCells('F6:G6');
  const card4Val = wsDash.getCell('F6');
  card4Val.value = `${(savingsRate * 100).toFixed(1)}% (${savingsRate >= 0.2 ? 'Sehat' : 'Perlu Dihemat'})`;
  card4Val.font = { name: THEME.fontFamily, size: 13, bold: true, color: { argb: THEME.cardRateText } };
  card4Val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.cardRateBg } };
  card4Val.alignment = { horizontal: 'center', vertical: 'middle' };

  wsDash.getRow(5).height = 20;
  wsDash.getRow(6).height = 30;

  // Apply border to KPI Cards
  ['B5', 'C5', 'B6', 'C6', 'D5', 'D6', 'E5', 'E6', 'F5', 'G5', 'F6', 'G6'].forEach((cellId) => {
    wsDash.getCell(cellId).border = BORDER_STYLE_THIN;
  });

  // Space
  wsDash.getRow(7).height = 10;

  // VISUAL BAR ARUS KAS SECTION (Row 8 & 9)
  wsDash.mergeCells('B8:G8');
  const barSectionHeader = wsDash.getCell('B8');
  barSectionHeader.value = 'BAR KOMPARASI ARUS KAS (INCOME VS OUTCOME RATIO)';
  barSectionHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: THEME.tableHeaderText } };
  barSectionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subHeaderBg } };
  barSectionHeader.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsDash.getRow(8).height = 24;

  wsDash.mergeCells('B9:G9');
  const barGraphicCell = wsDash.getCell('B9');
  const incBar = generateDataBar(1 - expenseRatio, 16);
  const expBar = generateDataBar(expenseRatio, 16);
  barGraphicCell.value = `Tabungan: [${incBar}] ${(Math.max(0, savingsRate) * 100).toFixed(0)}%   |   Pengeluaran: [${expBar}] ${(Math.min(100, expenseRatio * 100)).toFixed(0)}%   |   Status: ${statusBadge}`;
  barGraphicCell.font = { name: 'Consolas', size: 10.5, bold: true, color: { argb: '1E293B' } };
  barGraphicCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  barGraphicCell.alignment = { horizontal: 'center', vertical: 'middle' };
  barGraphicCell.border = BORDER_STYLE_THIN;
  wsDash.getRow(9).height = 28;

  // Space
  wsDash.getRow(10).height = 14;

  // CATEGORY BREAKDOWN TABLES (Row 11 onwards)
  // Left side: Expense Category (B:D), Right side: Income Category (E:G)
  wsDash.mergeCells('B11:D11');
  const catExpHeader = wsDash.getCell('B11');
  catExpHeader.value = 'RINCIAN PENGELUARAN PER KATEGORI';
  catExpHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: 'FFFFFF' } };
  catExpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BE123C' } };
  catExpHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  wsDash.mergeCells('E11:G11');
  const catIncHeader = wsDash.getCell('E11');
  catIncHeader.value = 'RINCIAN PEMASUKAN PER KATEGORI';
  catIncHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: 'FFFFFF' } };
  catIncHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '047857' } };
  catIncHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDash.getRow(11).height = 24;

  // Subheaders Row 12
  const subheadersExp = ['Kategori', 'Visual Share Bar', 'Nominal (Rp)'];
  subheadersExp.forEach((sh, idx) => {
    const col = ['B', 'C', 'D'][idx];
    const cell = wsDash.getCell(`${col}12`);
    cell.value = sh;
    cell.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.alignment = { horizontal: idx === 2 ? 'right' : idx === 1 ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_STYLE_THIN;
  });

  const subheadersInc = ['Kategori', 'Visual Share Bar', 'Nominal (Rp)'];
  subheadersInc.forEach((sh, idx) => {
    const col = ['E', 'F', 'G'][idx];
    const cell = wsDash.getCell(`${col}12`);
    cell.value = sh;
    cell.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.alignment = { horizontal: idx === 2 ? 'right' : idx === 1 ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_STYLE_THIN;
  });
  wsDash.getRow(12).height = 20;

  // Aggregate Category Incomes & Expenses
  const expenseByCategory = {};
  filteredExpenses.forEach((e) => {
    const cat = extractCategory(e, 'Lainnya');
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(e.amount || 0);
  });
  const sortedExpCategories = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  const incomeByCategory = {};
  filteredIncomes.forEach((i) => {
    const cat = extractCategory(i, 'Lainnya');
    incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(i.amount || 0);
  });
  const sortedIncCategories = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);

  const maxCategoryRows = Math.max(sortedExpCategories.length, sortedIncCategories.length, 6);
  let curDashRow = 13;

  for (let idx = 0; idx < maxCategoryRows; idx++) {
    const row = wsDash.getRow(curDashRow);
    row.height = 20;
    const isEven = idx % 2 === 0;
    const zebraBg = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;

    // Expense side
    const expItem = sortedExpCategories[idx];
    const cellB = wsDash.getCell(`B${curDashRow}`);
    const cellC = wsDash.getCell(`C${curDashRow}`);
    const cellD = wsDash.getCell(`D${curDashRow}`);

    if (expItem) {
      const [catName, amt] = expItem;
      const share = totalExp > 0 ? amt / totalExp : 0;
      const bar = generateDataBar(share, 10);

      cellB.value = catName;
      cellB.font = { name: THEME.fontFamily, size: 9.5 };
      cellB.alignment = { horizontal: 'left', vertical: 'middle' };

      cellC.value = `${bar} ${(share * 100).toFixed(0)}%`;
      cellC.font = { name: 'Consolas', size: 9, bold: true, color: { argb: 'BE123C' } };
      cellC.alignment = { horizontal: 'center', vertical: 'middle' };

      cellD.value = amt;
      cellD.numFmt = CURRENCY_FORMAT;
      cellD.font = { name: THEME.fontFamily, size: 9.5, bold: true };
      cellD.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cellB.value = '-';
      cellC.value = '-';
      cellD.value = 0;
      cellD.numFmt = CURRENCY_FORMAT;
      [cellB, cellC, cellD].forEach(c => {
        c.font = { name: THEME.fontFamily, size: 9, color: { argb: '94A3B8' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    // Income side
    const incItem = sortedIncCategories[idx];
    const cellE = wsDash.getCell(`E${curDashRow}`);
    const cellF = wsDash.getCell(`F${curDashRow}`);
    const cellG = wsDash.getCell(`G${curDashRow}`);

    if (incItem) {
      const [catName, amt] = incItem;
      const share = totalInc > 0 ? amt / totalInc : 0;
      const bar = generateDataBar(share, 10);

      cellE.value = catName;
      cellE.font = { name: THEME.fontFamily, size: 9.5 };
      cellE.alignment = { horizontal: 'left', vertical: 'middle' };

      cellF.value = `${bar} ${(share * 100).toFixed(0)}%`;
      cellF.font = { name: 'Consolas', size: 9, bold: true, color: { argb: '047857' } };
      cellF.alignment = { horizontal: 'center', vertical: 'middle' };

      cellG.value = amt;
      cellG.numFmt = CURRENCY_FORMAT;
      cellG.font = { name: THEME.fontFamily, size: 9.5, bold: true };
      cellG.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cellE.value = '-';
      cellF.value = '-';
      cellG.value = 0;
      cellG.numFmt = CURRENCY_FORMAT;
      [cellE, cellF, cellG].forEach(c => {
        c.font = { name: THEME.fontFamily, size: 9, color: { argb: '94A3B8' } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    [cellB, cellC, cellD, cellE, cellF, cellG].forEach(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraBg } };
      c.border = BORDER_STYLE_THIN;
    });

    curDashRow++;
  }

  // Total Category Row
  const totalExpRow = curDashRow;
  wsDash.getCell(`B${totalExpRow}`).value = 'TOTAL PENGELUARAN';
  wsDash.getCell(`C${totalExpRow}`).value = '100.0%';
  wsDash.getCell(`D${totalExpRow}`).value = totalExp;
  wsDash.getCell(`D${totalExpRow}`).numFmt = CURRENCY_FORMAT;

  wsDash.getCell(`E${totalExpRow}`).value = 'TOTAL PEMASUKAN';
  wsDash.getCell(`F${totalExpRow}`).value = '100.0%';
  wsDash.getCell(`G${totalExpRow}`).value = totalInc;
  wsDash.getCell(`G${totalExpRow}`).numFmt = CURRENCY_FORMAT;

  ['B', 'C', 'D', 'E', 'F', 'G'].forEach((col) => {
    const c = wsDash.getCell(`${col}${totalExpRow}`);
    c.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: '0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    c.border = BORDER_STYLE_TOTAL;
    if (col === 'D' || col === 'G') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else if (col === 'C' || col === 'F') c.alignment = { horizontal: 'center', vertical: 'middle' };
    else c.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  wsDash.getRow(totalExpRow).height = 24;

  // -------------------------------------------------------------
  // SHEET 2: 📅 RINCIAN HARIAN (DAILY DETAIL)
  // -------------------------------------------------------------
  const wsDaily = wb.addWorksheet('📅 Rekap Harian', {
    properties: { tabColor: { argb: '3B82F6' } },
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }],
  });

  wsDaily.columns = [
    { width: 4 },  // A (padding)
    { width: 8 },  // B (No)
    { width: 16 }, // C (Tanggal)
    { width: 14 }, // D (Hari)
    { width: 14 }, // E (Trx Count)
    { width: 22 }, // F (Pemasukan)
    { width: 22 }, // G (Pengeluaran)
    { width: 22 }, // H (Netto)
    { width: 28 }, // I (Visual Bar)
    { width: 18 }, // J (Status)
  ];

  // Title Banner
  wsDaily.mergeCells('B1:J1');
  const dailyTitle = wsDaily.getCell('B1');
  dailyTitle.value = `REKAPITULASI AKTIVITAS KEUANGAN HARIAN — ${periodTitle.toUpperCase()}`;
  dailyTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  dailyTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  dailyTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDaily.getRow(1).height = 32;

  // Table Headers
  const dailyHeaders = [
    'No', 'Tanggal', 'Hari', 'Jml Trx', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Netto / Selisih (Rp)', 'Visual Bar (In vs Out)', 'Status Harian'
  ];
  const dailyCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  dailyHeaders.forEach((dh, idx) => {
    const cell = wsDaily.getCell(`${dailyCols[idx]}3`);
    cell.value = dh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 4 && idx <= 6 ? 'right' : 'center', vertical: 'middle' };
  });
  wsDaily.getRow(3).height = 24;

  // Group transactions by date
  const dailyMap = {};
  filteredIncomes.forEach((i) => {
    const d = i.income_date;
    if (!d) return;
    if (!dailyMap[d]) dailyMap[d] = { date: d, inc: 0, exp: 0, count: 0 };
    dailyMap[d].inc += Number(i.amount || 0);
    dailyMap[d].count += 1;
  });
  filteredExpenses.forEach((e) => {
    const d = e.expense_date;
    if (!d) return;
    if (!dailyMap[d]) dailyMap[d] = { date: d, inc: 0, exp: 0, count: 0 };
    dailyMap[d].exp += Number(e.amount || 0);
    dailyMap[d].count += 1;
  });

  const sortedDailyList = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  let dailyRowIdx = 4;
  let runningDailyInc = 0;
  let runningDailyExp = 0;

  const maxDayAmount = Math.max(...sortedDailyList.map(d => Math.max(d.inc, d.exp)), 1);

  sortedDailyList.forEach((dItem, index) => {
    const row = wsDaily.getRow(dailyRowIdx);
    row.height = 21;
    const isEven = index % 2 === 0;
    const zebra = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;
    const netto = dItem.inc - dItem.exp;

    runningDailyInc += dItem.inc;
    runningDailyExp += dItem.exp;

    const bar = generateCompareBar(dItem.inc, dItem.exp, maxDayAmount, 8);
    const dayName = getIndoDayName(dItem.date);

    wsDaily.getCell(`B${dailyRowIdx}`).value = index + 1;
    wsDaily.getCell(`C${dailyRowIdx}`).value = dItem.date;
    wsDaily.getCell(`D${dailyRowIdx}`).value = dayName;
    wsDaily.getCell(`E${dailyRowIdx}`).value = dItem.count;
    wsDaily.getCell(`F${dailyRowIdx}`).value = dItem.inc;
    wsDaily.getCell(`F${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`G${dailyRowIdx}`).value = dItem.exp;
    wsDaily.getCell(`G${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`H${dailyRowIdx}`).value = netto;
    wsDaily.getCell(`H${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`I${dailyRowIdx}`).value = bar;
    wsDaily.getCell(`I${dailyRowIdx}`).font = { name: 'Consolas', size: 9 };
    wsDaily.getCell(`J${dailyRowIdx}`).value = netto > 0 ? '🟢 Surplus' : netto < 0 ? '🔴 Defisit' : '⚪ Seimbang';

    dailyCols.forEach((col) => {
      const c = wsDaily.getCell(`${col}${dailyRowIdx}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'F' || col === 'G' || col === 'H') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'H' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col === 'I') {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.font = { name: THEME.fontFamily, size: 9.5 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    dailyRowIdx++;
  });

  // Daily Total Row
  if (sortedDailyList.length > 0) {
    const totalDNetto = runningDailyInc - runningDailyExp;
    wsDaily.getCell(`B${dailyRowIdx}`).value = '';
    wsDaily.getCell(`C${dailyRowIdx}`).value = 'TOTAL';
    wsDaily.getCell(`D${dailyRowIdx}`).value = '';
    wsDaily.getCell(`E${dailyRowIdx}`).value = sortedDailyList.reduce((acc, d) => acc + d.count, 0);
    wsDaily.getCell(`F${dailyRowIdx}`).value = runningDailyInc;
    wsDaily.getCell(`F${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`G${dailyRowIdx}`).value = runningDailyExp;
    wsDaily.getCell(`G${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`H${dailyRowIdx}`).value = totalDNetto;
    wsDaily.getCell(`H${dailyRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsDaily.getCell(`I${dailyRowIdx}`).value = totalDNetto >= 0 ? '✅ TOTAL SURPLUS' : '⚠️ TOTAL DEFISIT';
    wsDaily.getCell(`J${dailyRowIdx}`).value = totalDNetto >= 0 ? '🟢 Sehat' : '🔴 Defisit';

    dailyCols.forEach((col) => {
      const c = wsDaily.getCell(`${col}${dailyRowIdx}`);
      c.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: '0F172A' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      c.border = BORDER_STYLE_TOTAL;
      if (col === 'F' || col === 'G' || col === 'H') c.alignment = { horizontal: 'right', vertical: 'middle' };
      else c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    wsDaily.getRow(dailyRowIdx).height = 25;
  }

  // -------------------------------------------------------------
  // SHEET 3: 🗓️ RINCIAN BULANAN (12 MONTHS MATRIX)
  // -------------------------------------------------------------
  const wsMonthly = wb.addWorksheet('🗓️ Rekap Bulanan (12 Bln)', {
    properties: { tabColor: { argb: 'F59E0B' } },
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }],
  });

  wsMonthly.columns = [
    { width: 4 },  // A (padding)
    { width: 8 },  // B (No)
    { width: 18 }, // C (Bulan)
    { width: 22 }, // D (Pemasukan)
    { width: 22 }, // E (Pengeluaran)
    { width: 22 }, // F (Net Cashflow)
    { width: 18 }, // G (Savings Rate %)
    { width: 28 }, // H (Visual Comparison Bar)
    { width: 18 }, // I (Kategori Utama)
    { width: 18 }, // J (Evaluasi)
  ];

  wsMonthly.mergeCells('B1:J1');
  const monthTitle = wsMonthly.getCell('B1');
  monthTitle.value = `MATRIKS ARUS KAS BULANAN TAHUN ${selectedYear} (12 BULAN)`;
  monthTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  monthTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  monthTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsMonthly.getRow(1).height = 32;

  const monthlyHeaders = [
    'No', 'Bulan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Net Cashflow (Rp)', 'Rasio Simpanan', 'Bar Komparasi (In vs Out)', 'Status Arus Kas', 'Evaluasi'
  ];
  const monthlyCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  monthlyHeaders.forEach((mh, idx) => {
    const cell = wsMonthly.getCell(`${monthlyCols[idx]}3`);
    cell.value = mh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 2 && idx <= 4 ? 'right' : 'center', vertical: 'middle' };
  });
  wsMonthly.getRow(3).height = 24;

  let mTotalInc = 0;
  let mTotalExp = 0;

  // Pre-calculate 12 months for selectedYear
  const monthDataArray = monthNames.map((mName, idx) => {
    const mNum = idx + 1;
    const inc = incomes
      .filter((i) => {
        const [y, m] = (i.income_date || '').split('-').map(Number);
        return y === selectedYear && m === mNum;
      })
      .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

    const exp = expenses
      .filter((e) => {
        const [y, m] = (e.expense_date || '').split('-').map(Number);
        return y === selectedYear && m === mNum;
      })
      .reduce((sum, curr) => sum + Number(curr.amount || 0), 0);

    mTotalInc += inc;
    mTotalExp += exp;

    return { mNum, mName, inc, exp, net: inc - exp };
  });

  const maxMonthAmt = Math.max(...monthDataArray.map(m => Math.max(m.inc, m.exp)), 100000);

  monthDataArray.forEach((mItem, idx) => {
    const rowNum = idx + 4;
    const row = wsMonthly.getRow(rowNum);
    row.height = 22;
    const isEven = idx % 2 === 0;
    const zebra = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;

    const rate = mItem.inc > 0 ? (mItem.net / mItem.inc) : 0;
    const bar = generateCompareBar(mItem.inc, mItem.exp, maxMonthAmt, 8);

    wsMonthly.getCell(`B${rowNum}`).value = idx + 1;
    wsMonthly.getCell(`C${rowNum}`).value = mItem.mName;
    wsMonthly.getCell(`D${rowNum}`).value = mItem.inc;
    wsMonthly.getCell(`D${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`E${rowNum}`).value = mItem.exp;
    wsMonthly.getCell(`E${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`F${rowNum}`).value = mItem.net;
    wsMonthly.getCell(`F${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`G${rowNum}`).value = mItem.inc > 0 ? `${(rate * 100).toFixed(1)}%` : '0.0%';
    wsMonthly.getCell(`H${rowNum}`).value = bar;
    wsMonthly.getCell(`H${rowNum}`).font = { name: 'Consolas', size: 9 };
    wsMonthly.getCell(`I${rowNum}`).value = mItem.net > 0 ? '🟢 Surplus' : mItem.net < 0 ? '🔴 Defisit' : '⚪ Seimbang';
    wsMonthly.getCell(`J${rowNum}`).value = rate >= 0.3 ? '⭐⭐⭐ Sangat Baik' : rate >= 0.1 ? '⭐⭐ Baik' : mItem.net < 0 ? '⚠️ Kurangi Beban' : '⚪ Netral';

    monthlyCols.forEach((col) => {
      const c = wsMonthly.getCell(`${col}${rowNum}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'D' || col === 'E' || col === 'F') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'F' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col === 'H') {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.font = { name: THEME.fontFamily, size: 9.5 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // Monthly Total & Average Rows
  const mTotalRow = 16;
  const mTotalNet = mTotalInc - mTotalExp;
  const mTotalRate = mTotalInc > 0 ? (mTotalNet / mTotalInc) : 0;

  wsMonthly.getCell(`B${mTotalRow}`).value = '';
  wsMonthly.getCell(`C${mTotalRow}`).value = 'TOTAL TAHUNAN';
  wsMonthly.getCell(`D${mTotalRow}`).value = mTotalInc;
  wsMonthly.getCell(`D${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`E${mTotalRow}`).value = mTotalExp;
  wsMonthly.getCell(`E${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`F${mTotalRow}`).value = mTotalNet;
  wsMonthly.getCell(`F${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`G${mTotalRow}`).value = `${(mTotalRate * 100).toFixed(1)}%`;
  wsMonthly.getCell(`H${mTotalRow}`).value = mTotalNet >= 0 ? '✅ SURPLUS TAHUNAN' : '⚠️ DEFISIT TAHUNAN';
  wsMonthly.getCell(`I${mTotalRow}`).value = mTotalNet >= 0 ? '🟢 Sehat' : '🔴 Defisit';
  wsMonthly.getCell(`J${mTotalRow}`).value = mTotalRate >= 0.2 ? 'Finansial Kuat' : 'Perlu Penghematan';

  monthlyCols.forEach((col) => {
    const c = wsMonthly.getCell(`${col}${mTotalRow}`);
    c.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: '0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    c.border = BORDER_STYLE_TOTAL;
    if (col === 'D' || col === 'E' || col === 'F') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsMonthly.getRow(mTotalRow).height = 25;

  // Monthly Average Row
  const mAvgRow = 17;
  wsMonthly.getCell(`B${mAvgRow}`).value = '';
  wsMonthly.getCell(`C${mAvgRow}`).value = 'RATA-RATA BULANAN';
  wsMonthly.getCell(`D${mAvgRow}`).value = Math.round(mTotalInc / 12);
  wsMonthly.getCell(`D${mAvgRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`E${mAvgRow}`).value = Math.round(mTotalExp / 12);
  wsMonthly.getCell(`E${mAvgRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`F${mAvgRow}`).value = Math.round(mTotalNet / 12);
  wsMonthly.getCell(`F${mAvgRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`G${mAvgRow}`).value = `${(mTotalRate * 100).toFixed(1)}%`;
  wsMonthly.getCell(`H${mAvgRow}`).value = 'Rata-rata Performa / Bulan';
  wsMonthly.getCell(`I${mAvgRow}`).value = 'Rerata';
  wsMonthly.getCell(`J${mAvgRow}`).value = 'Benchmark';

  monthlyCols.forEach((col) => {
    const c = wsMonthly.getCell(`${col}${mAvgRow}`);
    c.font = { name: THEME.fontFamily, size: 9.5, italic: true, bold: true, color: { argb: '475569' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    c.border = BORDER_STYLE_THIN;
    if (col === 'D' || col === 'E' || col === 'F') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsMonthly.getRow(mAvgRow).height = 22;

  // -------------------------------------------------------------
  // SHEET 4: 📈 REKAP KUARTAL & TAHUNAN (QUARTERLY & YEARLY TREND)
  // -------------------------------------------------------------
  const wsYearly = wb.addWorksheet('📈 Rekap Kuartal & Tren', {
    properties: { tabColor: { argb: '8B5CF6' } },
    views: [{ showGridLines: true }],
  });

  wsYearly.columns = [
    { width: 4 },  // A
    { width: 14 }, // B
    { width: 20 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 22 }, // F
    { width: 26 }, // G
    { width: 20 }, // H
  ];

  wsYearly.mergeCells('B1:H1');
  const qTitle = wsYearly.getCell('B1');
  qTitle.value = `ANALISIS KUARTAL & TAHUNAN — WASAP FINANCIAL REPORT`;
  qTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  qTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  qTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsYearly.getRow(1).height = 32;

  const qHeaders = ['Kuartal', 'Rentang Bulan', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Netto Kuartal (Rp)', 'Bar Komparasi Kuartal', 'Tingkat Tabungan'];
  const qCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];

  qHeaders.forEach((qh, idx) => {
    const cell = wsYearly.getCell(`${qCols[idx]}3`);
    cell.value = qh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 2 && idx <= 4 ? 'right' : 'center', vertical: 'middle' };
  });
  wsYearly.getRow(3).height = 24;

  const quarters = [
    { name: 'Kuartal 1 (Q1)', months: 'Januari - Maret', mIndices: [0, 1, 2] },
    { name: 'Kuartal 2 (Q2)', months: 'April - Juni', mIndices: [3, 4, 5] },
    { name: 'Kuartal 3 (Q3)', months: 'Juli - September', mIndices: [6, 7, 8] },
    { name: 'Kuartal 4 (Q4)', months: 'Oktober - Desember', mIndices: [9, 10, 11] },
  ];

  const qMaxAmt = Math.max(...quarters.map(q => {
    const inc = q.mIndices.reduce((sum, idx) => sum + monthDataArray[idx].inc, 0);
    const exp = q.mIndices.reduce((sum, idx) => sum + monthDataArray[idx].exp, 0);
    return Math.max(inc, exp);
  }), 1);

  quarters.forEach((q, idx) => {
    const rowNum = idx + 4;
    const row = wsYearly.getRow(rowNum);
    row.height = 23;
    const qInc = q.mIndices.reduce((sum, i) => sum + monthDataArray[i].inc, 0);
    const qExp = q.mIndices.reduce((sum, i) => sum + monthDataArray[i].exp, 0);
    const qNet = qInc - qExp;
    const qRate = qInc > 0 ? (qNet / qInc) : 0;
    const bar = generateCompareBar(qInc, qExp, qMaxAmt, 8);
    const zebra = idx % 2 === 0 ? THEME.zebraOddBg : THEME.zebraEvenBg;

    wsYearly.getCell(`B${rowNum}`).value = q.name;
    wsYearly.getCell(`C${rowNum}`).value = q.months;
    wsYearly.getCell(`D${rowNum}`).value = qInc;
    wsYearly.getCell(`D${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`E${rowNum}`).value = qExp;
    wsYearly.getCell(`E${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`F${rowNum}`).value = qNet;
    wsYearly.getCell(`F${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`G${rowNum}`).value = bar;
    wsYearly.getCell(`G${rowNum}`).font = { name: 'Consolas', size: 9 };
    wsYearly.getCell(`H${rowNum}`).value = `${(qRate * 100).toFixed(1)}% (${qNet >= 0 ? 'Surplus' : 'Defisit'})`;

    qCols.forEach((col) => {
      const c = wsYearly.getCell(`${col}${rowNum}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'D' || col === 'E' || col === 'F') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'F' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col === 'G') {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.font = { name: THEME.fontFamily, size: 9.5 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
  });

  // Space & Financial Health Recommendations
  wsYearly.mergeCells('B10:H10');
  const tipHeader = wsYearly.getCell('B10');
  tipHeader.value = 'TIPS & REKOMENDASI KESEHATAN KEUANGAN PERSONAL';
  tipHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: 'FFFFFF' } };
  tipHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subHeaderBg } };
  tipHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  wsYearly.getRow(10).height = 24;

  const adviceRows = [
    ['Aturan 50/30/20', 'Alokasikan 50% untuk Kebutuhan Pokok, 30% untuk Keinginan/Gaya Hidup, dan minimal 20% untuk Tabungan/Investasi.'],
    ['Dana Darurat', 'Idealnya siapkan dana darurat sebesar 3 hingga 6 kali total pengeluaran bulanan Anda untuk antisipasi hal tak terduga.'],
    ['Evaluasi Pengeluaran', 'Kategori pengeluaran terbesar Anda perlu ditinjau setiap akhir bulan untuk melihat potensi efisiensi.'],
    ['Disiplin Pencatatan', 'Rutin mencatat setiap transaksi harian melalui Wasap Hub agar arus kas selalu terpantau secara realtime.'],
  ];

  adviceRows.forEach((adv, idx) => {
    const rNum = idx + 11;
    const row = wsYearly.getRow(rNum);
    row.height = 22;

    const cellB = wsYearly.getCell(`B${rNum}`);
    cellB.value = adv[0];
    cellB.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: '0F172A' } };
    cellB.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    cellB.border = BORDER_STYLE_THIN;
    cellB.alignment = { horizontal: 'center', vertical: 'middle' };

    wsYearly.mergeCells(`C${rNum}:H${rNum}`);
    const cellC = wsYearly.getCell(`C${rNum}`);
    cellC.value = adv[1];
    cellC.font = { name: THEME.fontFamily, size: 9.5, color: { argb: '334155' } };
    cellC.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF' } };
    cellC.border = BORDER_STYLE_THIN;
    cellC.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  });

  // -------------------------------------------------------------
  // SHEET 5: 📑 BUKU KAS & JURNAL TRANSAKSI LENGKAP
  // -------------------------------------------------------------
  const wsJournal = wb.addWorksheet('📑 Buku Kas & Jurnal Transaksi', {
    properties: { tabColor: { argb: 'EC4899' } },
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }],
  });

  wsJournal.columns = [
    { width: 4 },  // A (padding)
    { width: 7 },  // B (No)
    { width: 14 }, // C (Tanggal)
    { width: 12 }, // D (Hari)
    { width: 16 }, // E (Tipe Transaksi)
    { width: 16 }, // F (Kategori)
    { width: 34 }, // G (Keterangan)
    { width: 20 }, // H (Pemasukan +)
    { width: 20 }, // I (Pengeluaran -)
    { width: 22 }, // J (Saldo Berjalan / Running Balance)
    { width: 16 }, // K (Status)
  ];

  wsJournal.mergeCells('B1:K1');
  const journalTitle = wsJournal.getCell('B1');
  journalTitle.value = `JURNAL TRANSAKSI & BUKU KAS LENGKAP — ${periodTitle.toUpperCase()}`;
  journalTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  journalTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  journalTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsJournal.getRow(1).height = 32;

  const journalHeaders = [
    'No', 'Tanggal', 'Hari', 'Tipe', 'Kategori', 'Keterangan Transaksi', 'Pemasukan (+)', 'Pengeluaran (-)', 'Saldo Berjalan', 'Indikator'
  ];
  const journalCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

  journalHeaders.forEach((jh, idx) => {
    const cell = wsJournal.getCell(`${journalCols[idx]}3`);
    cell.value = jh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 6 && idx <= 8 ? 'right' : 'center', vertical: 'middle' };
  });
  wsJournal.getRow(3).height = 24;

  // Combine and sort chronologically (earliest to latest for running balance)
  const combinedTransactions = [
    ...filteredIncomes.map((i) => ({
      date: i.income_date,
      type: 'PEMASUKAN',
      category: extractCategory(i, 'Gaji'),
      desc: cleanDescription(i.description),
      incomeAmt: Number(i.amount || 0),
      expenseAmt: 0,
    })),
    ...filteredExpenses.map((e) => ({
      date: e.expense_date,
      type: 'PENGELUARAN',
      category: extractCategory(e, 'Makan'),
      desc: cleanDescription(e.description),
      incomeAmt: 0,
      expenseAmt: Number(e.amount || 0),
    })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  let jRowIdx = 4;

  combinedTransactions.forEach((trx, idx) => {
    const row = wsJournal.getRow(jRowIdx);
    row.height = 21;
    const isEven = idx % 2 === 0;
    const zebra = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;

    runningBalance += trx.incomeAmt - trx.expenseAmt;
    const dayName = getIndoDayName(trx.date);

    wsJournal.getCell(`B${jRowIdx}`).value = idx + 1;
    wsJournal.getCell(`C${jRowIdx}`).value = trx.date || '-';
    wsJournal.getCell(`D${jRowIdx}`).value = dayName;
    wsJournal.getCell(`E${jRowIdx}`).value = trx.type;
    wsJournal.getCell(`F${jRowIdx}`).value = trx.category;
    wsJournal.getCell(`G${jRowIdx}`).value = trx.desc || '-';
    wsJournal.getCell(`H${jRowIdx}`).value = trx.incomeAmt > 0 ? trx.incomeAmt : null;
    wsJournal.getCell(`H${jRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsJournal.getCell(`I${jRowIdx}`).value = trx.expenseAmt > 0 ? trx.expenseAmt : null;
    wsJournal.getCell(`I${jRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsJournal.getCell(`J${jRowIdx}`).value = runningBalance;
    wsJournal.getCell(`J${jRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsJournal.getCell(`K${jRowIdx}`).value = trx.type === 'PEMASUKAN' ? '🟢 Masuk' : '🔴 Keluar';

    journalCols.forEach((col) => {
      const c = wsJournal.getCell(`${col}${jRowIdx}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'H' || col === 'I' || col === 'J') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'J' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (col === 'E') {
        c.font = {
          name: THEME.fontFamily,
          size: 9,
          bold: true,
          color: { argb: trx.type === 'PEMASUKAN' ? '047857' : 'BE123C' },
        };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (col === 'G') {
        c.font = { name: THEME.fontFamily, size: 9.5 };
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      } else {
        c.font = { name: THEME.fontFamily, size: 9.5 };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    jRowIdx++;
  });

  // Final Accounting Total Row for Journal
  wsJournal.getCell(`B${jRowIdx}`).value = '';
  wsJournal.getCell(`C${jRowIdx}`).value = 'TOTAL';
  wsJournal.getCell(`D${jRowIdx}`).value = '';
  wsJournal.getCell(`E${jRowIdx}`).value = '';
  wsJournal.getCell(`F${jRowIdx}`).value = '';
  wsJournal.getCell(`G${jRowIdx}`).value = `TOTAL KESELURUHAN (${combinedTransactions.length} TRANSAKSI)`;
  wsJournal.getCell(`H${jRowIdx}`).value = totalInc;
  wsJournal.getCell(`H${jRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsJournal.getCell(`I${jRowIdx}`).value = totalExp;
  wsJournal.getCell(`I${jRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsJournal.getCell(`J${jRowIdx}`).value = runningBalance;
  wsJournal.getCell(`J${jRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsJournal.getCell(`K${jRowIdx}`).value = runningBalance >= 0 ? '🟢 Surplus' : '🔴 Defisit';

  journalCols.forEach((col) => {
    const c = wsJournal.getCell(`${col}${jRowIdx}`);
    c.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: '0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    c.border = BORDER_STYLE_TOTAL;
    if (col === 'H' || col === 'I' || col === 'J') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else if (col === 'G') c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    else c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsJournal.getRow(jRowIdx).height = 25;

  // -------------------------------------------------------------
  // GENERATE & TRIGGER DOWNLOAD
  // -------------------------------------------------------------
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `${filePrefix}_${new Date().getTime().toString().slice(-4)}.xlsx`;

  if (typeof window !== 'undefined') {
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  return { success: true, fileName, buffer };
}
