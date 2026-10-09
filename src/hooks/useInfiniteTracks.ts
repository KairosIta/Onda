import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SourceId, Track } from '@/types/track';

export interface TrackPage {
  tracks: Track[];
  failed?: { source: SourceId; message: string }[];
  /**
   * Da dove riprende la pagina dopo; assente quando l'elenco e' finito.
   * Il hook non lo legge, lo passa e basta: lo decide chi conosce le
   * sorgenti (`SourceCursor` in services/sources/federation).
   */
  next?: unknown;
}

/**
 * Scroll infinito su qualunque elenco di tracce, federato o no.
 *
 * Ogni pagina porta il cursore della successiva, e `fetchPage` lo riceve
 * cosi' com'e' (alla prima pagina `null`). Il cursore e' per sorgente:
 * una sorgente caduta richiede la stessa pagina alla volta dopo senza
 * fermare le altre, quindi l'elenco cresce anche con una sorgente giu'.
 */
export function useInfiniteTracks(
  key: unknown[],
  fetchPage: (cursor: unknown) => Promise<TrackPage>,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: null as unknown,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    /**
     * Senza `next` l'elenco e' finito: tutte le sorgenti hanno dato una
     * pagina vuota senza errori. Una sorgente caduta non chiude niente,
     * resta nel cursore e si richiede allo scroll successivo: chiudere qui
     * la paginazione la chiuderebbe per sempre, perche' la query resta in
     * cache e l'elenco non riparte piu' da solo.
     */
    getNextPageParam: (lastPage) => lastPage.next,
  });

  // Dedup difensivo: i "trending" cambiano ordine tra una chiamata e
  // l'altra e la stessa traccia puo' ripresentarsi alla pagina dopo.
  const tracks = useMemo(() => {
    const seen = new Set<string>();
    const out: Track[] = [];
    for (const page of query.data?.pages ?? []) {
      for (const t of page.tracks) {
        if (!seen.has(t.uid)) {
          seen.add(t.uid);
          out.push(t);
        }
      }
    }
    return out;
  }, [query.data]);

  /**
   * Mostra lo stato dell'ultimo tentativo. Finche' una sorgente resta giu'
   * ogni pagina nuova lo ripete; quando torna, il vecchio avviso non deve
   * rimanere a schermo.
   */
  const failed = query.data?.pages.at(-1)?.failed ?? [];

  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  };

  return {
    tracks,
    failed,
    loadMore,
    /** Ricarica da capo: serve al bottone dopo una caduta totale. */
    retry: query.refetch,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
  };
}
