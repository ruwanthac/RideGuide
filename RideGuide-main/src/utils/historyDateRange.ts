/** Local calendar day boundaries for inclusive range checks on ISO timestamps. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function normalizeDateRange(
  from: Date | null,
  to: Date | null
): { from: Date | null; to: Date | null } {
  if (!from || !to) return { from, to };
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  if (a <= b) return { from: startOfDay(from), to: startOfDay(to) };
  return { from: startOfDay(to), to: startOfDay(from) };
}

export function isIsoInCalendarRange(iso: string, from: Date | null, to: Date | null): boolean {
  if (!from && !to) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const { from: f, to: e } = normalizeDateRange(from, to);
  if (f && t < startOfDay(f).getTime()) return false;
  if (e && t > endOfDay(e).getTime()) return false;
  return true;
}
