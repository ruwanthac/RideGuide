export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface ParsedPagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(query: Record<string, unknown>): ParsedPagination {
  const rawPage = parseInt(String(query.page ?? DEFAULT_PAGE), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  let rawLimit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(rawLimit) || rawLimit < 1) rawLimit = DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, rawLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export interface PaginatedPayload<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function paginated<T>(items: T[], total: number, page: number, limit: number): PaginatedPayload<T> {
  return { items, total, page, limit };
}
