export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PaginationWindow {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

function toSafeInteger(value: number | undefined, fallback: number): number {
  if (
    typeof value !== 'number' ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.trunc(value);
}

export function paginate(
  page: number | undefined = DEFAULT_PAGE,
  limit: number | undefined = DEFAULT_LIMIT,
): PaginationWindow {
  const safePage = Math.max(1, toSafeInteger(page, DEFAULT_PAGE));
  const requestedLimit = Math.max(1, toSafeInteger(limit, DEFAULT_LIMIT));
  const safeLimit = Math.min(requestedLimit, MAX_LIMIT);

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}
