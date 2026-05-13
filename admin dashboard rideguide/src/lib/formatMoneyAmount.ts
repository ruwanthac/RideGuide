/** Space-separated thousands + fixed decimals (e.g. 200000 → "200 000.00"). */
export function formatMoneyAmount(value: number | null | undefined, decimals = 2): string {
  if (value == null || !Number.isFinite(Number(value))) {
    return decimals > 0 ? `0.${'0'.repeat(decimals)}` : '0';
  }
  let n = Number(value);
  const neg = n < 0;
  n = Math.abs(n);
  const [intRaw, frac = ''] = n.toFixed(decimals).split('.');
  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const body = decimals > 0 && frac.length ? `${grouped}.${frac}` : grouped;
  return neg ? `-${body}` : body;
}

/** e.g. `LKR 200 000.00` */
export function formatCurrencyAmount(
  currency: string | null | undefined,
  value: number | null | undefined,
  decimals = 2,
): string {
  const c = (currency ?? 'LKR').trim() || 'LKR';
  return `${c} ${formatMoneyAmount(value, decimals)}`;
}
