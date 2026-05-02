export interface Pagination {
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>): Pagination {
  const rawLimit = Number(query["limit"]);
  const rawOffset = Number(query["offset"]);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 1000) : 100;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}
