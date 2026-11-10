/**
 * Read every row of a list, page by page. Supabase returns at most 1,000 rows per request by default,
 * so a single request would silently drop the rest (e.g. attendance after a few months).
 * @template T
 * @param {(from: number, to: number) => PromiseLike<{data: T[] | null, error: any}>} fetchPage
 * @param {number} [pageSize]
 * @returns {Promise<{rows: T[], error: any}>}
 */
export async function collectPages(fetchPage, pageSize = 1000) {
  const rows = [];
  for (let from = 0; from <= 2_000_000; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) return { rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return { rows, error: null };
  }
  return { rows, error: { message: 'Too many records to load' } };
}
