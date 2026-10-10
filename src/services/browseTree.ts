import type { BrowseCategory, BrowseItem } from '@rntp/player';
import type { LibraryState } from '@/store/librarySchema';
import type { Track } from '@/types/track';
import type { IsSourceActive } from './playableTracks';

/**
 * L'albero che Android Auto mostra al posto dell'app: preferiti, playlist
 * e ascolti recenti, cioe' quello che in macchina si vuole senza cercare.
 * Modulo puro sulla libreria persistita; l'invio al player sta in
 * `browseTreeSync`.
 *
 * Niente `extras`: i brani della libreria si risolvono dall'uid con
 * `resolve`, e un albero da trecento voci con il modello intero dentro
 * ognuna passerebbe il bridge a ogni salvataggio della libreria.
 *
 * I brani di una sorgente spenta non ci sono: in macchina partirebbero
 * dallo stream salvato, senza passare dall'app (vedi `playableTracks`).
 */

/** Tetto per categoria: uno schermo in auto non e' fatto per scorrere a lungo. */
export const BROWSE_MAX_ITEMS = 100;

function playable(t: Track): BrowseItem {
  return {
    mediaId: t.uid,
    title: t.title,
    artist: t.artist,
    // La misura grande: sul display dell'auto le copertine sono enormi.
    artworkUrl: t.artworkLargeUrl ?? t.artworkUrl,
    url: t.streamUrl,
    duration: t.durationSec,
  };
}

export function buildBrowseTree(library: LibraryState, isActive: IsSourceActive): BrowseCategory[] {
  const list = (uids: string[]): BrowseItem[] =>
    uids
      .map((uid) => library.tracks[uid])
      .filter((t): t is Track => Boolean(t) && isActive(t.source))
      .slice(0, BROWSE_MAX_ITEMS)
      .map(playable);

  const categories: BrowseCategory[] = [];

  const favorites = list(library.favorites);
  if (favorites.length > 0) {
    categories.push({ mediaId: 'onda:favorites', title: 'Preferiti', items: favorites });
  }

  // Ogni playlist e' una cartella; quelle vuote non si mostrano, in auto
  // aprire una cartella vuota e' solo un tocco sprecato.
  const playlists: BrowseItem[] = library.playlists
    .map((p) => ({ mediaId: `onda:playlist:${p.id}`, title: p.name, children: list(p.trackUids) }))
    .filter((p) => p.children.length > 0);
  if (playlists.length > 0) {
    categories.push({ mediaId: 'onda:playlists', title: 'Playlist', items: playlists });
  }

  const history = list(library.history);
  if (history.length > 0) {
    categories.push({ mediaId: 'onda:history', title: 'Ascoltati di recente', items: history });
  }

  return categories;
}
