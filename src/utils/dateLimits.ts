// src/utils/dateLimits.ts

export function toLocalISODate(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDaysISO(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split("-").map(Number);
  const dt = new Date();
  dt.setFullYear(y);
  dt.setMonth((m || 1) - 1);
  dt.setDate(d || 1);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + days);
  return toLocalISODate(dt);
}

/**
 * true = dateISO liegt innerhalb von "daysAhead" Tagen (inkl. heute)
 * Beispiel daysAhead=7: erlaubt heute bis heute+7
 */
export function isWithinDaysAhead(dateISO: string, daysAhead: number): boolean {
  const todayISO = toLocalISODate(new Date());
  const maxISO = addDaysISO(todayISO, daysAhead);
  return dateISO >= todayISO && dateISO <= maxISO;
}