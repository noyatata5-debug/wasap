/**
 * High-DPI Canvas Chart Generator for Financial Reports
 * Standardized for Corporate Finance, FP&A, and Personal Wealth Templates.
 */

// Helper to format currency numbers compactly for chart axes & data labels
export function formatCompactIDR(val) {
  if (val === 0 || isNaN(val)) return 'Rp 0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    const num = (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}Rp ${num}M`;
  }
  if (abs >= 1_000_000) {
    const num = (abs / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${sign}Rp ${num}jt`;
  }
  if (abs >= 1_000) {
    const num = (abs / 1_000).toFixed(0);
    return `${sign}Rp ${num}rb`;
  }
  return `${sign}Rp ${abs.toLocaleString('id-ID')}`;
}

// Fallback helper for drawing rounded rectangle
function drawRoundRect(ctx, x, y, width, height, radius) {
  if (width <= 0 || height <= 0) return;
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * CHART 1: Perbandingan Realisasi Income vs Outcome Bulanan
 * Horizontal Clustered Bar Chart (12 Bulan)
 */
export function generateIncomeVsOutcomeChart({
  monthData = [],
  year = new Date().getFullYear(),
  width = 1100,
  height = 720,
}) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Background & Outer Card Border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 4, 4, width - 8, height - 8, 16);
  ctx.stroke();

  // 2. Chart Header (Title & Subtitle)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Perbandingan Realisasi Income vs Outcome Bulanan', 36, 42);

  ctx.fillStyle = '#64748B';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Nominal Realisasi Arus Kas (Rp) — Tahun ${year}`, 36, 66);

  // 3. Legend (Top Right)
  const legendRight = width - 40;
  // Item 2: Outcome
  ctx.fillStyle = '#38BDF8'; // Sky Blue
  drawRoundRect(ctx, legendRight - 145, 34, 14, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Aktual Outcome', legendRight - 124, 46);

  // Item 1: Income
  ctx.fillStyle = '#1E40AF'; // Deep Navy Blue
  drawRoundRect(ctx, legendRight - 280, 34, 14, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.fillText('Aktual Income', legendRight - 259, 46);

  // 4. Plot Layout Dimensions
  const plotLeft = 145;
  const plotTop = 100;
  const plotRight = width - 45;
  const plotBottom = height - 55;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Determine Max Value for Scale
  const rawMax = Math.max(...monthData.map((m) => Math.max(m.inc || 0, m.exp || 0)), 1000000);
  // Calculate round max with nice intervals
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / magnitude;
  let niceFactor = 1;
  if (normalized <= 1) niceFactor = 1;
  else if (normalized <= 2) niceFactor = 2;
  else if (normalized <= 5) niceFactor = 5;
  else niceFactor = 10;
  const maxScale = Math.max(niceFactor * magnitude, 1000000);

  const numTicks = 5;
  const tickInterval = maxScale / numTicks;

  // 5. Vertical Gridlines & X-Axis Ticks
  ctx.lineWidth = 1;
  for (let i = 0; i <= numTicks; i++) {
    const val = tickInterval * i;
    const x = plotLeft + (val / maxScale) * plotWidth;

    // Gridline
    ctx.strokeStyle = i === 0 ? '#94A3B8' : '#F1F5F9';
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();

    // Axis Tick Label
    ctx.fillStyle = '#64748B';
    ctx.font = '11.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatCompactIDR(val), x, plotBottom + 20);
  }

  // Axis Title at bottom center
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Nominal (Rp)', plotLeft + plotWidth / 2, plotBottom + 42);

  // 6. Draw 12 Monthly Bars
  const rowHeight = plotHeight / 12;
  const barHeight = 12;

  monthData.forEach((mItem, idx) => {
    const rowY = plotTop + idx * rowHeight;
    const centerY = rowY + rowHeight / 2;

    // Month Label (Left)
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mItem.mName || `Bulan ${idx + 1}`, plotLeft - 16, centerY + 4);

    // Subtle Row Divider Line
    if (idx > 0) {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, rowY);
      ctx.lineTo(plotRight, rowY);
      ctx.stroke();
    }

    const inc = mItem.inc || 0;
    const exp = mItem.exp || 0;

    // Income Bar (Top)
    const incY = centerY - barHeight - 1.5;
    const incWidth = maxScale > 0 ? (inc / maxScale) * plotWidth : 0;
    if (incWidth > 0) {
      ctx.fillStyle = '#1E40AF'; // Executive Navy
      drawRoundRect(ctx, plotLeft, incY, incWidth, barHeight, 3);
      ctx.fill();

      // Data label if fits or at end
      ctx.fillStyle = '#1E40AF';
      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatCompactIDR(inc), plotLeft + incWidth + 6, incY + barHeight - 2);
    }

    // Outcome Bar (Bottom)
    const expY = centerY + 1.5;
    const expWidth = maxScale > 0 ? (exp / maxScale) * plotWidth : 0;
    if (expWidth > 0) {
      ctx.fillStyle = '#38BDF8'; // Sky Blue
      drawRoundRect(ctx, plotLeft, expY, expWidth, barHeight, 3);
      ctx.fill();

      // Data label
      ctx.fillStyle = '#0284C7';
      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatCompactIDR(exp), plotLeft + expWidth + 6, expY + barHeight - 2);
    }
  });

  // Base Y-Axis Vertical Line
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.stroke();

  return canvas.toDataURL('image/png').replace(/^data:image\/[a-z]+;base64,/, '');
}

/**
 * CHART 2: Pertumbuhan Surplus Arus Kas Bersih (Net Cash)
 * Diverging Horizontal Bar Chart (Positive/Negative Net Cash)
 */
export function generateNetCashChart({
  monthData = [],
  year = new Date().getFullYear(),
  width = 1100,
  height = 720,
}) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Background & Outer Card Border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, 4, 4, width - 8, height - 8, 16);
  ctx.stroke();

  // 2. Chart Header (Title & Subtitle)
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pertumbuhan Surplus Arus Kas Bersih (Net Cash)', 36, 42);

  ctx.fillStyle = '#64748B';
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`Surplus / Defisit Arus Kas Bulanan (Rp) — Tahun ${year}`, 36, 66);

  // 3. Legend (Top Right)
  const legendRight = width - 40;
  // Item 2: Defisit (Red)
  ctx.fillStyle = '#DC2626';
  drawRoundRect(ctx, legendRight - 120, 34, 14, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Defisit Kas', legendRight - 99, 46);

  // Item 1: Net Arus Kas / Surplus (Green)
  ctx.fillStyle = '#15803D'; // Forest Green
  drawRoundRect(ctx, legendRight - 265, 34, 14, 14, 3);
  ctx.fill();
  ctx.fillStyle = '#334155';
  ctx.fillText('Net Arus Kas', legendRight - 244, 46);

  // 4. Plot Layout Dimensions
  const plotLeft = 145;
  const plotTop = 100;
  const plotRight = width - 45;
  const plotBottom = height - 55;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Determine Min & Max for Net Cash
  const netValues = monthData.map((m) => m.net || 0);
  const rawMin = Math.min(...netValues, 0);
  const rawMax = Math.max(...netValues, 1000000);

  const hasNegative = rawMin < 0;
  const maxAbs = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1000000);

  // Scale bounds
  let minScale = 0;
  let maxScale = maxAbs;

  if (hasNegative) {
    // Symmetrical or proportional zero
    minScale = -maxAbs;
    maxScale = maxAbs;
  }

  const range = maxScale - minScale;
  const zeroX = plotLeft + ((0 - minScale) / range) * plotWidth;

  // 5. Gridlines & X-Axis Ticks
  const numTicks = 6;
  ctx.lineWidth = 1;

  for (let i = 0; i <= numTicks; i++) {
    const val = minScale + (range / numTicks) * i;
    const x = plotLeft + ((val - minScale) / range) * plotWidth;

    ctx.strokeStyle = Math.abs(val) < 1 ? '#64748B' : '#F1F5F9';
    ctx.beginPath();
    ctx.moveTo(x, plotTop);
    ctx.lineTo(x, plotBottom);
    ctx.stroke();

    // Axis Tick Label
    ctx.fillStyle = '#64748B';
    ctx.font = '11.5px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatCompactIDR(val), x, plotBottom + 20);
  }

  // Axis Title at bottom center
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Surplus Bersih (Rp)', plotLeft + plotWidth / 2, plotBottom + 42);

  // 6. Draw 12 Monthly Net Cash Bars
  const rowHeight = plotHeight / 12;
  const barHeight = 20;

  monthData.forEach((mItem, idx) => {
    const rowY = plotTop + idx * rowHeight;
    const centerY = rowY + rowHeight / 2;

    // Month Label (Left)
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mItem.mName || `Bulan ${idx + 1}`, plotLeft - 16, centerY + 4);

    // Subtle Row Divider Line
    if (idx > 0) {
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotLeft, rowY);
      ctx.lineTo(plotRight, rowY);
      ctx.stroke();
    }

    const net = mItem.net || 0;
    const barY = centerY - barHeight / 2;

    if (net > 0) {
      const barW = (net / range) * plotWidth;
      ctx.fillStyle = '#15803D'; // Forest Green
      drawRoundRect(ctx, zeroX, barY, barW, barHeight, 4);
      ctx.fill();

      // Label at right of bar
      ctx.fillStyle = '#166534';
      ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${formatCompactIDR(net)}`, zeroX + barW + 6, centerY + 4);
    } else if (net < 0) {
      const barW = (Math.abs(net) / range) * plotWidth;
      const startX = zeroX - barW;
      ctx.fillStyle = '#DC2626'; // Crimson Red
      drawRoundRect(ctx, startX, barY, barW, barHeight, 4);
      ctx.fill();

      // Label at left of bar
      ctx.fillStyle = '#991B1B';
      ctx.font = 'bold 10.5px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatCompactIDR(net), startX - 6, centerY + 4);
    } else {
      // Zero net: small dot or neutral indicator
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(zeroX, centerY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Highlight Zero Vertical Line
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(zeroX, plotTop);
  ctx.lineTo(zeroX, plotBottom);
  ctx.stroke();

  return canvas.toDataURL('image/png').replace(/^data:image\/[a-z]+;base64,/, '');
}
