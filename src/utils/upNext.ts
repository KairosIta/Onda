/**
 * Cosa viene dopo il brano corrente, per la riga "Prossimo" del player.
 * Modulo puro: la coda arriva come elenco di titoli, le preferenze come
 * stringhe, e la regola si verifica senza player.
 */

export interface UpNextInput {
  items: { title: string; artist: string }[];
  activeIndex: number | null;
  shuffle: boolean;
  repeat: 'off' | 'one' | 'all';
}

export type UpNext =
  | { kind: 'track'; index: number; title: string; artist: string }
  /** Con lo shuffle nativo l'ordine e' privato di RNTP: si dice, non si inventa. */
  | { kind: 'shuffle' }
  | { kind: 'repeat-one' }
  /** Ultimo brano senza ripetizione: dopo, silenzio. */
  | { kind: 'end' }
  | { kind: 'none' };

export function describeUpNext({ items, activeIndex, shuffle, repeat }: UpNextInput): UpNext {
  if (activeIndex === null || items.length === 0) return { kind: 'none' };
  if (repeat === 'one') return { kind: 'repeat-one' };
  if (shuffle) return { kind: 'shuffle' };

  const next = activeIndex + 1;
  if (next < items.length) return { kind: 'track', index: next, ...items[next] };
  if (repeat === 'all' && items.length > 1) return { kind: 'track', index: 0, ...items[0] };
  if (repeat === 'all') return { kind: 'repeat-one' };
  return { kind: 'end' };
}

/** Testo della riga "Prossimo" nel player; vuoto quando non c'e' niente da dire. */
export function upNextLabel(next: UpNext): string {
  switch (next.kind) {
    case 'track':
      return `${next.title} · ${next.artist}`;
    case 'shuffle':
      return 'ordine casuale';
    case 'repeat-one':
      return 'questo brano, di nuovo';
    case 'end':
      return 'fine della coda';
    default:
      return '';
  }
}
