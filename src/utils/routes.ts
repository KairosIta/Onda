/**
 * I parametri delle route arrivano da deep link e da URL scritti a mano, non
 * solo dai tocchi dell'app: si accettano solo i valori previsti e il resto
 * si rifiuta in modo esplicito, invece di aprire una schermata a caso.
 */

export type CollectionKind = 'favorites' | 'history';

const COLLECTION_KINDS: readonly CollectionKind[] = ['favorites', 'history'];

export function parseCollectionKind(kind: string | string[] | undefined): CollectionKind | null {
  return typeof kind === 'string' && (COLLECTION_KINDS as readonly string[]).includes(kind)
    ? (kind as CollectionKind)
    : null;
}

/**
 * Un id di artista o album deve esserci ed essere una sola stringa non
 * vuota: `?id=` e `?id=a&id=b` non aprono niente.
 */
export function parseEntityId(id: string | string[] | undefined): string | null {
  return typeof id === 'string' && id.trim() !== '' ? id : null;
}
