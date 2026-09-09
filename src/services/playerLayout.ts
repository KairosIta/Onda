/**
 * Quanto può essere grande la copertina nel player senza spingere i
 * controlli e l'attribuzione fuori dallo schermo. Prima era larga quanto
 * il pannello e basta: su uno schermo basso, o con un titolo su due righe
 * e la scala dei caratteri alta, la riga della licenza finiva sotto la
 * barra di navigazione.
 */

/** Sotto questa misura la copertina non racconta più niente: si scorre. */
export const ARTWORK_MIN = 160;

/**
 * Altezza che il resto del pannello occupa sempre, in dp a scala 1:
 * barra in alto, slider, controlli, margini. Non cresce con i caratteri.
 */
const FIXED_DP = 300;
/**
 * Parte fatta di testo: titolo su due righe, artista, tempi, riga
 * «Prossimo», attribuzione. Cresce con la scala dei caratteri.
 */
const TEXT_DP = 230;

export interface PlayerViewport {
  width: number;
  height: number;
  fontScale: number;
  insetTop: number;
  insetBottom: number;
  /** Padding orizzontale del pannello, da entrambi i lati. */
  horizontalPadding: number;
}

export interface ArtworkLayout {
  size: number;
  /** Non c'è spazio nemmeno per la copertina minima: il pannello scorre. */
  cramped: boolean;
}

export function artworkLayout(v: PlayerViewport): ArtworkLayout {
  const byWidth = Math.max(0, v.width - 2 * v.horizontalPadding);
  const free = v.height - v.insetTop - v.insetBottom - FIXED_DP - TEXT_DP * v.fontScale;
  const cramped = free < ARTWORK_MIN;
  return {
    size: Math.round(Math.min(byWidth, Math.max(ARTWORK_MIN, free))),
    cramped,
  };
}
