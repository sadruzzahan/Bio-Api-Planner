/**
 * Express query params arrive as strings; Orval-generated zod schemas use
 * zod.date() (not zod.coerce.date()) for date/date-time query params.
 * Pre-process the raw query object so string date values become Date objects
 * before Zod validation runs.
 */
export function coerceDateFields(
  query: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  const result = { ...query };
  for (const field of fields) {
    const raw = result[field];
    if (typeof raw === "string" && raw.length > 0) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        result[field] = d;
      }
    }
  }
  return result;
}
