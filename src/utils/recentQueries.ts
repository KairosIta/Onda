/**
 * Le ultime ricerche, per rifarle con un tocco. Poche, le piu' recenti in
 * testa, senza doppioni: "lofi" cercato tre volte e' una voce sola.
 * Modulo puro; la persistenza sta in `store/searchHistory`.
 */

export const RECENT_QUERIES_MAX = 8;

const clean = (query: string): string => query.trim().replace(/\s+/g, ' ');

/** Rilegge da disco scartando cio' che non e' una stringa utile. */
export function loadQueries(value: unknown, max = RECENT_QUERIES_MAX): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const q = clean(raw);
    if (!q || out.some((x) => x.toLowerCase() === q.toLowerCase())) continue;
    out.push(q);
    if (out.length === max) break;
  }
  return out;
}

/** Mette `query` in testa; un doppione (senza distinguere le maiuscole) sale invece di raddoppiare. */
export function pushQuery(list: string[], query: string, max = RECENT_QUERIES_MAX): string[] {
  const q = clean(query);
  if (!q) return list;
  const rest = list.filter((x) => x.toLowerCase() !== q.toLowerCase());
  return [q, ...rest].slice(0, max);
}

export function dropQuery(list: string[], query: string): string[] {
  const q = clean(query).toLowerCase();
  return list.filter((x) => x.toLowerCase() !== q);
}
