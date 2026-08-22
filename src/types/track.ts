/**
 * Modello unificato. Audius e Jamendo restituiscono strutture molto diverse:
 * tutto quello che entra nell'app passa prima da qui.
 */

export type SourceId = 'audius' | 'jamendo';

export interface Track {
  /** `${source}:${id}` — chiave univoca globale, evita collisioni tra sorgenti. */
  uid: string;
  source: SourceId;
  id: string;
  title: string;
  artist: string;
  /** Misura da lista: righe da 48dp e schede da 128dp. */
  artworkUrl?: string;
  /**
   * Misura da player: l'artwork li' e' largo quanto lo schermo, e la
   * copertina di lista ci arriva sgranata. Separata e non sostitutiva,
   * altrimenti ogni riga di un elenco scaricherebbe l'immagine grande.
   */
  artworkLargeUrl?: string;
  durationSec: number;
  streamUrl: string;
  /** Pagina canonica del brano sulla piattaforma che lo fornisce. */
  sourceUrl?: string;
  /** Licenza o regime di diritti dichiarato dalla sorgente. */
  rightsLabel?: string;
  /** URL della licenza specifica restituita dalla sorgente, quando disponibile. */
  licenseUrl?: string;
  /** Apre la pagina artista. Su Audius e' `user.id`, su Jamendo `artist_id`. */
  artistId?: string;
  /** Solo Jamendo: su Audius il concetto di album esiste ma e' quasi sempre vuoto. */
  albumId?: string;
  albumName?: string;
}

export interface ListParams {
  limit?: number;
  offset?: number;
}

export interface SearchParams extends ListParams {
  query: string;
}

export interface TrendingParams extends ListParams {
  /** Gia' tradotto nel nome che la sorgente si aspetta (vedi services/genres.ts). */
  genre?: string;
}

export interface ArtistInfo {
  id: string;
  source: SourceId;
  name: string;
  imageUrl?: string;
  bio?: string;
  /** Riga di contesto sotto il nome: follower, numero di brani, ... */
  detail?: string;
}

export interface AlbumInfo {
  id: string;
  source: SourceId;
  name: string;
  artist: string;
  imageUrl?: string;
  detail?: string;
}

/**
 * Contratto che ogni sorgente deve rispettare. Aggiungerne una terza
 * (Free Music Archive, un server locale, ...) significa implementare
 * questa interfaccia e registrarla in sources/index.ts.
 *
 * I metodi album sono opzionali: non tutte le sorgenti hanno il concetto.
 */
export interface MusicSource {
  id: SourceId;
  label: string;
  search(params: SearchParams): Promise<Track[]>;
  trending(params?: TrendingParams): Promise<Track[]>;
  artistTracks(artistId: string, params?: ListParams): Promise<Track[]>;
  artistInfo(artistId: string): Promise<ArtistInfo>;
  albumTracks?(albumId: string, params?: ListParams): Promise<Track[]>;
  albumInfo?(albumId: string): Promise<AlbumInfo>;
}

export const makeUid = (source: SourceId, id: string): string => `${source}:${id}`;
