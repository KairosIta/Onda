import type { SourceId } from '@/types/track';

/**
 * Le due sorgenti nominano i generi in modo diverso: Audius ha una
 * tassonomia chiusa ("Hip-Hop/Rap"), Jamendo usa tag liberi minuscoli.
 * Qui sta l'unica tabella di traduzione: le schermate maneggiano solo
 * la `key`.
 *
 * Un tag Jamendo sconosciuto non e' un errore, torna una lista vuota:
 * la sorgente che risponde continua a riempire la schermata.
 *
 * Un nome per ogni sorgente: con una sorgente nuova in `SOURCE_IDS`, ogni
 * genere senza la sua traduzione smette di compilare. Senza, la sorgente
 * riceverebbe il trending generale dentro la pagina di un genere.
 */
export type Genre = { key: string; label: string } & Record<SourceId, string>;

export const GENRES: Genre[] = [
  { key: 'electronic', label: 'Elettronica', audius: 'Electronic', jamendo: 'electronic' },
  { key: 'hiphop', label: 'Hip-Hop', audius: 'Hip-Hop/Rap', jamendo: 'hiphop' },
  { key: 'rock', label: 'Rock', audius: 'Rock', jamendo: 'rock' },
  { key: 'pop', label: 'Pop', audius: 'Pop', jamendo: 'pop' },
  { key: 'jazz', label: 'Jazz', audius: 'Jazz', jamendo: 'jazz' },
  { key: 'classical', label: 'Classica', audius: 'Classical', jamendo: 'classical' },
  { key: 'ambient', label: 'Ambient', audius: 'Ambient', jamendo: 'ambient' },
  { key: 'lofi', label: 'Lo-Fi', audius: 'Lo-Fi', jamendo: 'lofi' },
  { key: 'metal', label: 'Metal', audius: 'Metal', jamendo: 'metal' },
  { key: 'folk', label: 'Folk', audius: 'Folk', jamendo: 'folk' },
  { key: 'reggae', label: 'Reggae', audius: 'Reggae', jamendo: 'reggae' },
  { key: 'soul', label: 'Soul & R&B', audius: 'R&B/Soul', jamendo: 'soul' },
  { key: 'world', label: 'World', audius: 'World', jamendo: 'world' },
];

/** Nome del genere nella lingua della sorgente, o undefined se non mappato. */
export function genreFor(key: string | undefined, source: SourceId): string | undefined {
  if (!key) return undefined;
  const genre = GENRES.find((g) => g.key === key);
  return genre?.[source];
}
