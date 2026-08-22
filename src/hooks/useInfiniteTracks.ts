import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { SourceId, Track } from '@/types/track';
import { nextTracksOffset } from './infiniteTracksCursor';

export interface TrackPage {
  tracks: Track[];
  failed?: { source: SourceId; message: string }[];
}

interface LoadedTrackPage extends TrackPage {
  /** Offset realmente usato per caricare questa pagina. */
  offset: number;
}

/**
 * Scroll infinito su qualunque elenco di tracce, federato o no.
 *
 * Ogni pagina conserva l'offset richiesto: dopo un successo completo avanza
 * di pageSize, mentre una risposta parziale ritenta lo stesso offset. Il
 * numero di tracce non puo' guidare il cursore perche' una pagina federata ne
 * contiene fino al doppio, una quota per sorgente.
 */
export function useInfiniteTracks(
  key: unknown[],
  fetchPage: (offset: number) => Promise<TrackPage>,
  { pageSize = 20, enabled = true }: { pageSize?: number; enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<LoadedTrackPage> => {
      const offset = pageParam as number;
      return { ...(await fetchPage(offset)), offset };
    },
    /**
     * Pagina vuota: il catalogo e' finito, si smette di chiedere.
     *
     * Ma solo se nessuna sorgente e' caduta. Una pagina vuota perche' meta'
     * federazione ha fallito non e' una fine elenco, e chiudere qui la
     * paginazione la chiuderebbe per sempre: la query resta in cache e
     * l'elenco non riparte piu' da solo. Se una sorgente e' caduta teniamo
     * vivo il cursore, cosi' lo scroll successivo riprova la stessa pagina.
     */
    getNextPageParam: (lastPage) =>
      nextTracksOffset(
        {
          offset: lastPage.offset,
          trackCount: lastPage.tracks.length,
          failedCount: lastPage.failed?.length ?? 0,
        },
        pageSize,
      ),
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
   * Mostra lo stato dell'ultimo tentativo. Una pagina parziale resta sullo
   * stesso offset finche' tutte le sorgenti rispondono; quando il recupero
   * riesce, il vecchio avviso non deve rimanere a schermo.
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
