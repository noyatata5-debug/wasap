import ExcelJS from 'exceljs';
import { generateIncomeVsOutcomeChart, generateNetCashChart } from './financeCharts';

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

// Styling Constants (Executive Finance Palette - Corporate Slate & Emerald)
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
  assets = [],
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

  // Pre-calculate 12 months data for selectedYear (Used for Financial Charts & Monthly Matrix)
  let mTotalInc = 0;
  let mTotalExp = 0;
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

  // Pre-render High-DPI Charts for insertion
  const chart1Base64 = generateIncomeVsOutcomeChart({
    monthData: monthDataArray,
    year: selectedYear,
    width: 1100,
    height: 700,
  });

  const chart2Base64 = generateNetCashChart({
    monthData: monthDataArray,
    year: selectedYear,
    width: 1100,
    height: 700,
  });

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
    { width: 18 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 18 }, // F
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
  wsDash.getRow(7).height = 12;

  // -------------------------------------------------------------
  // FINANCIAL CHARTS SECTION (Row 8 to 25)
  // Replaces the old text unicode bar with executive FP&A charts
  // -------------------------------------------------------------
  wsDash.mergeCells('B8:G8');
  const chartSectionHeader = wsDash.getCell('B8');
  chartSectionHeader.value = `GRAFIK PERFORMA KEUANGAN & ARUS KAS TAHUN ${selectedYear} (INCOME VS OUTCOME & SURPLUS)`;
  chartSectionHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: THEME.tableHeaderText } };
  chartSectionHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subHeaderBg } };
  chartSectionHeader.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsDash.getRow(8).height = 24;

  // Reserve rows 9 to 25 with 20pt height for side-by-side charts
  for (let r = 9; r <= 25; r++) {
    wsDash.getRow(r).height = 20;
  }

  // Embed Chart 1: Income vs Outcome (Left: Col B to D)
  if (chart1Base64) {
    const imgId1 = wb.addImage({
      base64: chart1Base64,
      extension: 'png',
    });
    wsDash.addImage(imgId1, {
      tl: { col: 1.05, row: 8.35 },
      ext: { width: 490, height: 325 },
      editAs: 'oneCell',
    });
  }

  // Embed Chart 2: Net Cash Growth (Right: Col E to G)
  if (chart2Base64) {
    const imgId2 = wb.addImage({
      base64: chart2Base64,
      extension: 'png',
    });
    wsDash.addImage(imgId2, {
      tl: { col: 4.1, row: 8.35 },
      ext: { width: 490, height: 325 },
      editAs: 'oneCell',
    });
  }

  // Space between charts and category tables
  wsDash.getRow(26).height = 16;

  // -------------------------------------------------------------
  // CATEGORY BREAKDOWN TABLES (Row 27 onwards)
  // Replaces 'Visual Share Bar' with standard financial 'Porsi (%)'
  // -------------------------------------------------------------
  wsDash.mergeCells('B27:D27');
  const catExpHeader = wsDash.getCell('B27');
  catExpHeader.value = 'RINCIAN PENGELUARAN PER KATEGORI';
  catExpHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: 'FFFFFF' } };
  catExpHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BE123C' } };
  catExpHeader.alignment = { horizontal: 'center', vertical: 'middle' };

  wsDash.mergeCells('E27:G27');
  const catIncHeader = wsDash.getCell('E27');
  catIncHeader.value = 'RINCIAN PEMASUKAN PER KATEGORI';
  catIncHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: 'FFFFFF' } };
  catIncHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '047857' } };
  catIncHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  wsDash.getRow(27).height = 24;

  // Subheaders Row 28
  const subheadersExp = ['Kategori', 'Porsi Beban (%)', 'Nominal (Rp)'];
  subheadersExp.forEach((sh, idx) => {
    const col = ['B', 'C', 'D'][idx];
    const cell = wsDash.getCell(`${col}28`);
    cell.value = sh;
    cell.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.alignment = { horizontal: idx === 2 ? 'right' : idx === 1 ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_STYLE_THIN;
  });

  const subheadersInc = ['Kategori', 'Porsi Pemasukan (%)', 'Nominal (Rp)'];
  subheadersInc.forEach((sh, idx) => {
    const col = ['E', 'F', 'G'][idx];
    const cell = wsDash.getCell(`${col}28`);
    cell.value = sh;
    cell.font = { name: THEME.fontFamily, size: 9, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.alignment = { horizontal: idx === 2 ? 'right' : idx === 1 ? 'center' : 'left', vertical: 'middle' };
    cell.border = BORDER_STYLE_THIN;
  });
  wsDash.getRow(28).height = 20;

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
  let curDashRow = 29;

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

      cellB.value = catName;
      cellB.font = { name: THEME.fontFamily, size: 9.5 };
      cellB.alignment = { horizontal: 'left', vertical: 'middle' };

      cellC.value = share;
      cellC.numFmt = PERCENT_FORMAT;
      cellC.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: 'BE123C' } };
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

      cellE.value = catName;
      cellE.font = { name: THEME.fontFamily, size: 9.5 };
      cellE.alignment = { horizontal: 'left', vertical: 'middle' };

      cellF.value = share;
      cellF.numFmt = PERCENT_FORMAT;
      cellF.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: '047857' } };
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
  wsDash.getCell(`C${totalExpRow}`).value = 1;
  wsDash.getCell(`C${totalExpRow}`).numFmt = PERCENT_FORMAT;
  wsDash.getCell(`D${totalExpRow}`).value = totalExp;
  wsDash.getCell(`D${totalExpRow}`).numFmt = CURRENCY_FORMAT;

  wsDash.getCell(`E${totalExpRow}`).value = 'TOTAL PEMASUKAN';
  wsDash.getCell(`F${totalExpRow}`).value = 1;
  wsDash.getCell(`F${totalExpRow}`).numFmt = PERCENT_FORMAT;
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
    { width: 18 }, // I (Margin Kas %)
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
    'No', 'Tanggal', 'Hari', 'Jml Trx', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Netto / Selisih (Rp)', 'Margin Kas (%)', 'Status Harian'
  ];
  const dailyCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  dailyHeaders.forEach((dh, idx) => {
    const cell = wsDaily.getCell(`${dailyCols[idx]}3`);
    cell.value = dh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 4 && idx <= 7 ? 'right' : 'center', vertical: 'middle' };
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

  sortedDailyList.forEach((dItem, index) => {
    const row = wsDaily.getRow(dailyRowIdx);
    row.height = 21;
    const isEven = index % 2 === 0;
    const zebra = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;
    const netto = dItem.inc - dItem.exp;

    runningDailyInc += dItem.inc;
    runningDailyExp += dItem.exp;

    const dayName = getIndoDayName(dItem.date);
    const marginKas = dItem.inc > 0 ? (netto / dItem.inc) : (dItem.exp > 0 ? -1 : 0);

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
    wsDaily.getCell(`I${dailyRowIdx}`).value = marginKas;
    wsDaily.getCell(`I${dailyRowIdx}`).numFmt = PERCENT_FORMAT;
    wsDaily.getCell(`J${dailyRowIdx}`).value = netto > 0 ? '🟢 Surplus' : netto < 0 ? '🔴 Defisit' : '⚪ Seimbang';

    dailyCols.forEach((col) => {
      const c = wsDaily.getCell(`${col}${dailyRowIdx}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'F' || col === 'G' || col === 'H' || col === 'I') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'H' || col === 'I', color: col === 'I' ? { argb: netto >= 0 ? '047857' : 'BE123C' } : undefined };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
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
    const totalMargin = runningDailyInc > 0 ? (totalDNetto / runningDailyInc) : 0;

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
    wsDaily.getCell(`I${dailyRowIdx}`).value = totalMargin;
    wsDaily.getCell(`I${dailyRowIdx}`).numFmt = PERCENT_FORMAT;
    wsDaily.getCell(`J${dailyRowIdx}`).value = totalDNetto >= 0 ? '🟢 Sehat' : '🔴 Defisit';

    dailyCols.forEach((col) => {
      const c = wsDaily.getCell(`${col}${dailyRowIdx}`);
      c.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: '0F172A' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
      c.border = BORDER_STYLE_TOTAL;
      if (col === 'F' || col === 'G' || col === 'H' || col === 'I') c.alignment = { horizontal: 'right', vertical: 'middle' };
      else c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    wsDaily.getRow(dailyRowIdx).height = 25;
  }

  // -------------------------------------------------------------
  // SHEET 3: 🗓️ RINCIAN BULANAN (12 MONTHS MATRIX + CHARTS)
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
    { width: 20 }, // G (Rasio Tabungan %)
    { width: 20 }, // H (Rasio Beban %)
    { width: 18 }, // I (Status Arus Kas)
    { width: 20 }, // J (Evaluasi)
  ];

  wsMonthly.mergeCells('B1:J1');
  const monthTitle = wsMonthly.getCell('B1');
  monthTitle.value = `MATRIKS ARUS KAS BULANAN TAHUN ${selectedYear} (12 BULAN)`;
  monthTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  monthTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  monthTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsMonthly.getRow(1).height = 32;

  const monthlyHeaders = [
    'No', 'Bulan', 'Pemasukan (Rp)', 'Pengeluaran (Rp)', 'Net Cashflow (Rp)', 'Rasio Tabungan (%)', 'Rasio Beban (%)', 'Status Arus Kas', 'Evaluasi'
  ];
  const monthlyCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  monthlyHeaders.forEach((mh, idx) => {
    const cell = wsMonthly.getCell(`${monthlyCols[idx]}3`);
    cell.value = mh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 2 && idx <= 6 ? 'right' : 'center', vertical: 'middle' };
  });
  wsMonthly.getRow(3).height = 24;

  monthDataArray.forEach((mItem, idx) => {
    const rowNum = idx + 4;
    const row = wsMonthly.getRow(rowNum);
    row.height = 22;
    const isEven = idx % 2 === 0;
    const zebra = isEven ? THEME.zebraOddBg : THEME.zebraEvenBg;

    const rate = mItem.inc > 0 ? (mItem.net / mItem.inc) : 0;
    const expRatio = mItem.inc > 0 ? (mItem.exp / mItem.inc) : (mItem.exp > 0 ? 1 : 0);

    wsMonthly.getCell(`B${rowNum}`).value = idx + 1;
    wsMonthly.getCell(`C${rowNum}`).value = mItem.mName;
    wsMonthly.getCell(`D${rowNum}`).value = mItem.inc;
    wsMonthly.getCell(`D${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`E${rowNum}`).value = mItem.exp;
    wsMonthly.getCell(`E${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`F${rowNum}`).value = mItem.net;
    wsMonthly.getCell(`F${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsMonthly.getCell(`G${rowNum}`).value = rate;
    wsMonthly.getCell(`G${rowNum}`).numFmt = PERCENT_FORMAT;
    wsMonthly.getCell(`H${rowNum}`).value = expRatio;
    wsMonthly.getCell(`H${rowNum}`).numFmt = PERCENT_FORMAT;
    wsMonthly.getCell(`I${rowNum}`).value = mItem.net > 0 ? '🟢 Surplus' : mItem.net < 0 ? '🔴 Defisit' : '⚪ Seimbang';
    wsMonthly.getCell(`J${rowNum}`).value = rate >= 0.3 ? '⭐⭐⭐ Sangat Baik' : rate >= 0.1 ? '⭐⭐ Baik' : mItem.net < 0 ? '⚠️ Kurangi Beban' : '⚪ Netral';

    monthlyCols.forEach((col) => {
      const c = wsMonthly.getCell(`${col}${rowNum}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'D' || col === 'E' || col === 'F' || col === 'G' || col === 'H') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'F' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
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
  const mTotalExpRatio = mTotalInc > 0 ? (mTotalExp / mTotalInc) : 0;

  wsMonthly.getCell(`B${mTotalRow}`).value = '';
  wsMonthly.getCell(`C${mTotalRow}`).value = 'TOTAL TAHUNAN';
  wsMonthly.getCell(`D${mTotalRow}`).value = mTotalInc;
  wsMonthly.getCell(`D${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`E${mTotalRow}`).value = mTotalExp;
  wsMonthly.getCell(`E${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`F${mTotalRow}`).value = mTotalNet;
  wsMonthly.getCell(`F${mTotalRow}`).numFmt = CURRENCY_FORMAT;
  wsMonthly.getCell(`G${mTotalRow}`).value = mTotalRate;
  wsMonthly.getCell(`G${mTotalRow}`).numFmt = PERCENT_FORMAT;
  wsMonthly.getCell(`H${mTotalRow}`).value = mTotalExpRatio;
  wsMonthly.getCell(`H${mTotalRow}`).numFmt = PERCENT_FORMAT;
  wsMonthly.getCell(`I${mTotalRow}`).value = mTotalNet >= 0 ? '🟢 Sehat' : '🔴 Defisit';
  wsMonthly.getCell(`J${mTotalRow}`).value = mTotalRate >= 0.2 ? 'Finansial Kuat' : 'Perlu Penghematan';

  monthlyCols.forEach((col) => {
    const c = wsMonthly.getCell(`${col}${mTotalRow}`);
    c.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: '0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    c.border = BORDER_STYLE_TOTAL;
    if (col === 'D' || col === 'E' || col === 'F' || col === 'G' || col === 'H') c.alignment = { horizontal: 'right', vertical: 'middle' };
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
  wsMonthly.getCell(`G${mAvgRow}`).value = mTotalRate;
  wsMonthly.getCell(`G${mAvgRow}`).numFmt = PERCENT_FORMAT;
  wsMonthly.getCell(`H${mAvgRow}`).value = mTotalExpRatio;
  wsMonthly.getCell(`H${mAvgRow}`).numFmt = PERCENT_FORMAT;
  wsMonthly.getCell(`I${mAvgRow}`).value = 'Rerata';
  wsMonthly.getCell(`J${mAvgRow}`).value = 'Benchmark';

  monthlyCols.forEach((col) => {
    const c = wsMonthly.getCell(`${col}${mAvgRow}`);
    c.font = { name: THEME.fontFamily, size: 9.5, italic: true, bold: true, color: { argb: '475569' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    c.border = BORDER_STYLE_THIN;
    if (col === 'D' || col === 'E' || col === 'F' || col === 'G' || col === 'H') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsMonthly.getRow(mAvgRow).height = 22;

  // Visual Charts Section in Sheet 3
  wsMonthly.getRow(18).height = 14;
  wsMonthly.mergeCells('B19:J19');
  const mChartHeader = wsMonthly.getCell('B19');
  mChartHeader.value = `GRAFIK PERFORMA KEUANGAN TAHUN ${selectedYear} (INCOME VS OUTCOME & SURPLUS BERSIH)`;
  mChartHeader.font = { name: THEME.fontFamily, size: 10, bold: true, color: { argb: THEME.tableHeaderText } };
  mChartHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.subHeaderBg } };
  mChartHeader.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  wsMonthly.getRow(19).height = 24;

  for (let r = 20; r <= 36; r++) {
    wsMonthly.getRow(r).height = 20;
  }

  if (chart1Base64) {
    const imgIdM1 = wb.addImage({
      base64: chart1Base64,
      extension: 'png',
    });
    wsMonthly.addImage(imgIdM1, {
      tl: { col: 1.05, row: 19.35 },
      ext: { width: 490, height: 325 },
      editAs: 'oneCell',
    });
  }

  if (chart2Base64) {
    const imgIdM2 = wb.addImage({
      base64: chart2Base64,
      extension: 'png',
    });
    wsMonthly.addImage(imgIdM2, {
      tl: { col: 5.2, row: 19.35 },
      ext: { width: 490, height: 325 },
      editAs: 'oneCell',
    });
  }

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
    { width: 20 }, // G
    { width: 20 }, // H
  ];

  wsYearly.mergeCells('B1:H1');
  const qTitle = wsYearly.getCell('B1');
  qTitle.value = `ANALISIS KUARTAL & TAHUNAN — WASAP FINANCIAL REPORT`;
  qTitle.font = { name: THEME.fontFamily, size: 12, bold: true, color: { argb: 'FFFFFF' } };
  qTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.headerBg } };
  qTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsYearly.getRow(1).height = 32;

  const qHeaders = ['Kuartal', 'Rentang Bulan', 'Total Pemasukan (Rp)', 'Total Pengeluaran (Rp)', 'Netto Kuartal (Rp)', 'Rasio Beban (%)', 'Tingkat Tabungan (%)'];
  const qCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];

  qHeaders.forEach((qh, idx) => {
    const cell = wsYearly.getCell(`${qCols[idx]}3`);
    cell.value = qh;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 2 && idx <= 6 ? 'right' : 'center', vertical: 'middle' };
  });
  wsYearly.getRow(3).height = 24;

  const quarters = [
    { name: 'Kuartal 1 (Q1)', months: 'Januari - Maret', mIndices: [0, 1, 2] },
    { name: 'Kuartal 2 (Q2)', months: 'April - Juni', mIndices: [3, 4, 5] },
    { name: 'Kuartal 3 (Q3)', months: 'Juli - September', mIndices: [6, 7, 8] },
    { name: 'Kuartal 4 (Q4)', months: 'Oktober - Desember', mIndices: [9, 10, 11] },
  ];

  quarters.forEach((q, idx) => {
    const rowNum = idx + 4;
    const row = wsYearly.getRow(rowNum);
    row.height = 23;
    const qInc = q.mIndices.reduce((sum, i) => sum + monthDataArray[i].inc, 0);
    const qExp = q.mIndices.reduce((sum, i) => sum + monthDataArray[i].exp, 0);
    const qNet = qInc - qExp;
    const qRate = qInc > 0 ? (qNet / qInc) : 0;
    const qExpRatio = qInc > 0 ? (qExp / qInc) : (qExp > 0 ? 1 : 0);
    const zebra = idx % 2 === 0 ? THEME.zebraOddBg : THEME.zebraEvenBg;

    wsYearly.getCell(`B${rowNum}`).value = q.name;
    wsYearly.getCell(`C${rowNum}`).value = q.months;
    wsYearly.getCell(`D${rowNum}`).value = qInc;
    wsYearly.getCell(`D${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`E${rowNum}`).value = qExp;
    wsYearly.getCell(`E${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`F${rowNum}`).value = qNet;
    wsYearly.getCell(`F${rowNum}`).numFmt = CURRENCY_FORMAT;
    wsYearly.getCell(`G${rowNum}`).value = qExpRatio;
    wsYearly.getCell(`G${rowNum}`).numFmt = PERCENT_FORMAT;
    wsYearly.getCell(`H${rowNum}`).value = qRate;
    wsYearly.getCell(`H${rowNum}`).numFmt = PERCENT_FORMAT;

    qCols.forEach((col) => {
      const c = wsYearly.getCell(`${col}${rowNum}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
      c.border = BORDER_STYLE_THIN;
      if (col === 'D' || col === 'E' || col === 'F' || col === 'G' || col === 'H') {
        c.font = { name: THEME.fontFamily, size: 9.5, bold: col === 'F' };
        c.alignment = { horizontal: 'right', vertical: 'middle' };
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
  // SHEET 6: 💎 PORTOFOLIO ASET & TABUNGAN
  // -------------------------------------------------------------
  const wsAssets = wb.addWorksheet('💎 Portofolio Aset & Tabungan', {
    properties: { tabColor: { argb: '0284C7' } },
    views: [{ state: 'frozen', ySplit: 8, showGridLines: true }],
  });

  wsAssets.columns = [
    { width: 4 },  // A (padding)
    { width: 6 },  // B (No)
    { width: 32 }, // C (Nama Aset)
    { width: 18 }, // D (Kategori)
    { width: 22 }, // E (Platform / Broker)
    { width: 16 }, // F (Kuantitas / Unit)
    { width: 20 }, // G (Modal Beli)
    { width: 22 }, // H (Nilai Saat Ini)
    { width: 20 }, // I (Laba / Rugi)
    { width: 14 }, // J (Return %)
    { width: 28 }, // K (Catatan)
  ];

  // Title Banner
  wsAssets.mergeCells('B1:K1');
  const assetTitle = wsAssets.getCell('B1');
  assetTitle.value = 'PORTOFOLIO ASET, TABUNGAN & INVESTASI';
  assetTitle.font = { name: THEME.fontFamily, size: 13, bold: true, color: { argb: 'FFFFFF' } };
  assetTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } };
  assetTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.getRow(1).height = 32;

  wsAssets.mergeCells('B2:K2');
  const assetSub = wsAssets.getCell('B2');
  assetSub.value = `Ringkasan Kepemilikan Aset Fisik & Digital (Emas, Saham, Kripto, Tabungan, Reksadana) — Diekspor pada ${exportDateStr}`;
  assetSub.font = { name: THEME.fontFamily, size: 9.5, italic: true, color: { argb: '64748B' } };
  assetSub.alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.getRow(2).height = 20;

  // Calculate Asset KPIs
  const totalAssetValue = assets.reduce((sum, a) => sum + Number(a.amount || 0), 0);
  const totalAssetCost = assets.reduce((sum, a) => sum + Number(a.buy_amount || 0), 0);
  const totalAssetProfit = totalAssetValue - totalAssetCost;
  const assetReturnPct = totalAssetCost > 0 ? totalAssetProfit / totalAssetCost : 0;

  // 4 Top KPI Cards (Rows 4-6)
  // Card 1: Total Nilai Aset (B4:C5)
  wsAssets.mergeCells('B4:C4');
  wsAssets.getCell('B4').value = 'TOTAL NILAI PORTOFOLIO';
  wsAssets.getCell('B4').font = { name: THEME.fontFamily, size: 8.5, bold: true, color: { argb: '0369A1' } };
  wsAssets.getCell('B4').alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.mergeCells('B5:C6');
  wsAssets.getCell('B5').value = totalAssetValue;
  wsAssets.getCell('B5').numFmt = CURRENCY_FORMAT;
  wsAssets.getCell('B5').font = { name: THEME.fontFamily, size: 14, bold: true, color: { argb: '0284C7' } };
  wsAssets.getCell('B5').alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 2: Total Modal Beli (D4:E5)
  wsAssets.mergeCells('D4:E4');
  wsAssets.getCell('D4').value = 'TOTAL MODAL AWAL';
  wsAssets.getCell('D4').font = { name: THEME.fontFamily, size: 8.5, bold: true, color: { argb: '475569' } };
  wsAssets.getCell('D4').alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.mergeCells('D5:E6');
  wsAssets.getCell('D5').value = totalAssetCost;
  wsAssets.getCell('D5').numFmt = CURRENCY_FORMAT;
  wsAssets.getCell('D5').font = { name: THEME.fontFamily, size: 14, bold: true, color: { argb: '334155' } };
  wsAssets.getCell('D5').alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 3: Keuntungan / PnL (F4:H5)
  wsAssets.mergeCells('F4:H4');
  wsAssets.getCell('F4').value = 'ESTIMASI LABA / RUGI (PnL)';
  wsAssets.getCell('F4').font = { name: THEME.fontFamily, size: 8.5, bold: true, color: { argb: totalAssetProfit >= 0 ? '065F46' : '991B1B' } };
  wsAssets.getCell('F4').alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.mergeCells('F5:H6');
  wsAssets.getCell('F5').value = totalAssetProfit;
  wsAssets.getCell('F5').numFmt = CURRENCY_FORMAT;
  wsAssets.getCell('F5').font = { name: THEME.fontFamily, size: 14, bold: true, color: { argb: totalAssetProfit >= 0 ? '059669' : 'DC2626' } };
  wsAssets.getCell('F5').alignment = { horizontal: 'center', vertical: 'middle' };

  // Card 4: Persentase Return (I4:K5)
  wsAssets.mergeCells('I4:K4');
  wsAssets.getCell('I4').value = 'RETURN INVESTASI (%)';
  wsAssets.getCell('I4').font = { name: THEME.fontFamily, size: 8.5, bold: true, color: { argb: assetReturnPct >= 0 ? '065F46' : '991B1B' } };
  wsAssets.getCell('I4').alignment = { horizontal: 'center', vertical: 'middle' };
  wsAssets.mergeCells('I5:K6');
  wsAssets.getCell('I5').value = assetReturnPct;
  wsAssets.getCell('I5').numFmt = PERCENT_FORMAT;
  wsAssets.getCell('I5').font = { name: THEME.fontFamily, size: 14, bold: true, color: { argb: assetReturnPct >= 0 ? '059669' : 'DC2626' } };
  wsAssets.getCell('I5').alignment = { horizontal: 'center', vertical: 'middle' };

  ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach((col) => {
    for (let r = 4; r <= 6; r++) {
      const cell = wsAssets.getCell(`${col}${r}`);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      cell.border = BORDER_STYLE_THIN;
    }
  });

  // Table Headers (Row 8)
  const assetCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const assetHeaders = [
    'No', 'Nama Aset', 'Kategori', 'Platform / Broker', 'Kuantitas / Unit',
    'Modal Awal', 'Nilai Terkini', 'Laba / Rugi', 'Return (%)', 'Catatan'
  ];

  assetHeaders.forEach((h, idx) => {
    const cell = wsAssets.getCell(`${assetCols[idx]}8`);
    cell.value = h;
    cell.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: THEME.tableHeaderText } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.tableHeaderBg } };
    cell.border = BORDER_STYLE_THIN;
    cell.alignment = { horizontal: idx >= 5 && idx <= 8 ? 'right' : 'center', vertical: 'middle' };
  });
  wsAssets.getRow(8).height = 26;

  // Populate Asset Items
  const categoryLabels = {
    emas: '🪙 Emas',
    saham: '📈 Saham',
    crypto: '⚡ Kripto',
    tabungan: '🏦 Tabungan',
    reksadana: '📊 Reksadana',
    lainnya: '🏢 Lainnya',
  };

  let aRowIdx = 9;
  assets.forEach((asset, idx) => {
    const row = wsAssets.getRow(aRowIdx);
    row.height = 22;

    const currentVal = Number(asset.amount || 0);
    const buyVal = Number(asset.buy_amount || 0);
    const profitVal = currentVal - buyVal;
    const profitPct = buyVal > 0 ? profitVal / buyVal : 0;
    const catLabel = categoryLabels[asset.category?.toLowerCase()] || asset.category || 'Lainnya';

    wsAssets.getCell(`B${aRowIdx}`).value = idx + 1;
    wsAssets.getCell(`C${aRowIdx}`).value = asset.name || '-';
    wsAssets.getCell(`D${aRowIdx}`).value = catLabel;
    wsAssets.getCell(`E${aRowIdx}`).value = asset.institution || '-';
    wsAssets.getCell(`F${aRowIdx}`).value = asset.quantity || '-';
    wsAssets.getCell(`G${aRowIdx}`).value = buyVal;
    wsAssets.getCell(`G${aRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsAssets.getCell(`H${aRowIdx}`).value = currentVal;
    wsAssets.getCell(`H${aRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsAssets.getCell(`I${aRowIdx}`).value = profitVal;
    wsAssets.getCell(`I${aRowIdx}`).numFmt = CURRENCY_FORMAT;
    wsAssets.getCell(`J${aRowIdx}`).value = profitPct;
    wsAssets.getCell(`J${aRowIdx}`).numFmt = PERCENT_FORMAT;
    wsAssets.getCell(`K${aRowIdx}`).value = asset.notes || '-';

    const zebraColor = idx % 2 === 0 ? THEME.zebraEvenBg : THEME.zebraOddBg;
    assetCols.forEach((col) => {
      const c = wsAssets.getCell(`${col}${aRowIdx}`);
      c.font = { name: THEME.fontFamily, size: 9, color: { argb: '1E293B' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebraColor } };
      c.border = BORDER_STYLE_THIN;

      if (col === 'G' || col === 'H' || col === 'I') {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        if (col === 'I') {
          c.font = {
            name: THEME.fontFamily,
            size: 9,
            bold: true,
            color: { argb: profitVal >= 0 ? '059669' : 'DC2626' }
          };
        }
      } else if (col === 'J') {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
        c.font = {
          name: THEME.fontFamily,
          size: 9,
          bold: true,
          color: { argb: profitPct >= 0 ? '059669' : 'DC2626' }
        };
      } else if (col === 'C' || col === 'K') {
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      } else {
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    aRowIdx++;
  });

  // Total Row for Assets
  wsAssets.getCell(`B${aRowIdx}`).value = '';
  wsAssets.getCell(`C${aRowIdx}`).value = `TOTAL PORTOFOLIO (${assets.length} ASET)`;
  wsAssets.getCell(`D${aRowIdx}`).value = '';
  wsAssets.getCell(`E${aRowIdx}`).value = '';
  wsAssets.getCell(`F${aRowIdx}`).value = '';
  wsAssets.getCell(`G${aRowIdx}`).value = totalAssetCost;
  wsAssets.getCell(`G${aRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsAssets.getCell(`H${aRowIdx}`).value = totalAssetValue;
  wsAssets.getCell(`H${aRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsAssets.getCell(`I${aRowIdx}`).value = totalAssetProfit;
  wsAssets.getCell(`I${aRowIdx}`).numFmt = CURRENCY_FORMAT;
  wsAssets.getCell(`J${aRowIdx}`).value = assetReturnPct;
  wsAssets.getCell(`J${aRowIdx}`).numFmt = PERCENT_FORMAT;
  wsAssets.getCell(`K${aRowIdx}`).value = totalAssetProfit >= 0 ? '🟢 Portofolio Untung' : '🔴 Portofolio Minus';

  assetCols.forEach((col) => {
    const c = wsAssets.getCell(`${col}${aRowIdx}`);
    c.font = { name: THEME.fontFamily, size: 9.5, bold: true, color: { argb: '0F172A' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    c.border = BORDER_STYLE_TOTAL;
    if (col === 'G' || col === 'H' || col === 'I' || col === 'J') c.alignment = { horizontal: 'right', vertical: 'middle' };
    else if (col === 'C') c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    else c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  wsAssets.getRow(aRowIdx).height = 25;

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
