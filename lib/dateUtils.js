/**
 * Date utility functions for Indonesian timezone and standard YYYY-MM-DD formatting.
 * Avoids UTC offset bugs where toISOString() returns yesterday's date between 00:00 - 06:59 WIB.
 */

export function getLocalDateString(dateInput = new Date()) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string'
    ? (dateInput.includes('T') ? new Date(dateInput) : new Date(dateInput + 'T00:00:00'))
    : new Date(dateInput);

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatIndoDate(dateInput, withWeekday = true) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string'
    ? (dateInput.includes('T') ? new Date(dateInput) : new Date(dateInput + 'T00:00:00'))
    : new Date(dateInput);

  if (isNaN(d.getTime())) return String(dateInput);

  const options = withWeekday
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric' };

  return d.toLocaleDateString('id-ID', options);
}

export function getRelativeDateBadge(targetDateStr, baseDateStr = getLocalDateString()) {
  if (!targetDateStr) return null;

  if (targetDateStr === baseDateStr) {
    return { label: 'Hari Ini', type: 'today', color: 'text-[#2e96ff] bg-[#2e96ff]/10 border-[#2e96ff]/30' };
  }

  try {
    const target = new Date(targetDateStr + 'T00:00:00');
    const base = new Date(baseDateStr + 'T00:00:00');
    const diffDays = Math.round((target - base) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return { label: 'Besok', type: 'tomorrow', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
    }
    if (diffDays === -1) {
      return { label: 'Kemarin', type: 'yesterday', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    if (diffDays > 1 && diffDays <= 7) {
      return {
        label: target.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
        type: 'upcoming',
        color: 'text-sky-400 bg-sky-500/10 border-sky-500/30'
      };
    }

    return {
      label: target.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      type: 'other',
      color: 'text-[var(--text-muted)] bg-[var(--bg-subtle)] border-[var(--border-color)]'
    };
  } catch (e) {
    return { label: targetDateStr, type: 'raw', color: 'text-[var(--text-muted)] bg-[var(--bg-subtle)] border-[var(--border-color)]' };
  }
}
