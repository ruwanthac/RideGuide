/** Canonical API returns `{ items, total, page, limit }` without `totalPages`. */
export function totalPagesFrom(total: number, limit: number): number {
  const lim = Math.max(1, limit);
  return Math.max(1, Math.ceil(total / lim));
}
