/**
 * Formats a time string (e.g. "14:30", "14:30:00", "09:00", "9:00") into a 12-hour format with AM/PM (e.g. "02:30 PM", "09:00 AM").
 * Strictly enforces 12-hour timing system across the platform.
 */
export function formatTime12(timeStr?: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed) return '';

  // If already formatted with AM/PM (e.g. "2:30 PM", "02:30 PM", "11:00 AM")
  if (/am|pm/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const [hPart, mPart] = trimmed.split(':');
  const h = parseInt(hPart, 10);
  if (isNaN(h)) return trimmed;

  const m = (mPart || '00').slice(0, 2);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${m} ${period}`;
}

/**
 * Normalizes title capitalization for gear listings and community requests.
 * Fixes irregular capitalization like "SNake Plant" -> "Snake Plant" and "bottle" -> "Bottle".
 */
export function formatCleanTitle(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/\b([A-Z]{2,})([a-z]+)/g, (_, upper, lower) => upper.charAt(0) + upper.slice(1).toLowerCase() + lower)
    .replace(/^([a-z])/, (m) => m.toUpperCase());
}


