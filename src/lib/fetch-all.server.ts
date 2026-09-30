/**
 * O Data API do backend corta cada consulta em 1000 linhas. Qualquer
 * agregação (contagem, soma, ranking) feita sobre uma consulta sem paginação
 * fica silenciosamente errada assim que a tabela passa desse tamanho.
 *
 * `fetchAllRows` busca todas as páginas. A primeira página deve ser montada com
 * `{ count: "exact" }` no `.select()` para que as demais sejam buscadas em
 * paralelo; sem contagem, as páginas são buscadas em sequência.
 *
 * A consulta precisa ter ordenação estável (ex.: `.order("created_at").order("id")`)
 * para que as páginas não se sobreponham.
 */
type PageResult<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}>;

const PAGE_SIZE = 1000;
const PARALLEL_PAGES = 5;

export async function fetchAllRows<T = any>(
  buildPage: (from: number, to: number) => PageResult<T>,
  opts: { maxRows?: number } = {},
): Promise<T[]> {
  const maxRows = opts.maxRows ?? 100_000;

  const first = await buildPage(0, PAGE_SIZE - 1);
  if (first.error) throw new Error(first.error.message);
  const all: T[] = [...(first.data ?? [])];
  if (all.length < PAGE_SIZE) return all;

  const total = typeof first.count === "number" ? Math.min(first.count, maxRows) : null;

  if (total !== null) {
    const offsets: number[] = [];
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from);
    for (let i = 0; i < offsets.length; i += PARALLEL_PAGES) {
      const batch = offsets.slice(i, i + PARALLEL_PAGES);
      const results = await Promise.all(batch.map((from) => buildPage(from, from + PAGE_SIZE - 1)));
      for (const r of results) {
        if (r.error) throw new Error(r.error.message);
        all.push(...(r.data ?? []));
      }
    }
    return all;
  }

  for (let from = PAGE_SIZE; from < maxRows; from += PAGE_SIZE) {
    const r = await buildPage(from, from + PAGE_SIZE - 1);
    if (r.error) throw new Error(r.error.message);
    const rows = r.data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}
