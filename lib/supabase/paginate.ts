export async function allPages<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; from < 100000; from += 500) {
    const result = await load(from, from + 499);
    if (result.error) return { data: rows, error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) return { data: rows, error: null };
  }
  return { data: rows, error: { message: 'Record limit reached' } };
}
