import { JAMENDO_CLIENT_ID } from '@/config/env';
import {
  type AlbumInfo,
  type ArtistInfo,
  type ListParams,
  makeUid,
  type MusicSource,
  type SearchParams,
  type Track,
  type TrendingParams,
} from '@/types/track';

const BASE = 'https://api.jamendo.com/v3.0';

interface JamendoTrack {
  id: string;
  name: string;
  artist_id?: string;
  artist_name: string;
  album_id?: string;
  album_name?: string;
  image?: string;
  album_image?: string;
  duration: number | string;
  audio: string;
  license_ccurl?: string;
  shareurl?: string;
  /** Posizione nell'album. C'e' anche nelle risposte piatte di /tracks/. */
  position?: number | string;
}

interface JamendoArtist {
  id: string;
  name: string;
  image?: string;
  joindate?: string;
}

interface JamendoAlbum {
  id: string;
  name: string;
  artist_name: string;
  image?: string;
  releasedate?: string;
}

function url(path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({
    client_id: JAMENDO_CLIENT_ID,
    format: 'json',
    // Default e' mp31 (~96 kbps): in cuffia la differenza si sente.
    audioformat: 'mp32',
    ...params,
  });
  return `${BASE}${path}?${qs.toString()}`;
}

function page({ limit = 20, offset = 0 }: ListParams = {}): Record<string, string> {
  return offset > 0 ? { limit: String(limit), offset: String(offset) } : { limit: String(limit) };
}

/** Massimo che Jamendo accetta in una richiesta: chiedere di piu' e' un 400. */
export const JAMENDO_MAX_LIMIT = 200;

/**
 * Tetto di sicurezza sulle pagine di un album. Duemila tracce sono ben
 * oltre qualunque raccolta reale: serve solo a non trasformare una
 * risposta anomala in un ciclo infinito di richieste.
 */
export const ALBUM_MAX_PAGES = 10;

/** Il minimo che serve per ordinare un album; il resto del campo non conta. */
export interface AlbumOrderable {
  id?: string;
  position?: number | string;
  audio?: string;
}

/**
 * Compone le pagine di un album in un elenco unico e ordinato.
 *
 * Ordinare pagina per pagina non basta: `position` e' la posizione nel
 * disco, quindi la traccia 3 puo' arrivare nella seconda richiesta e
 * dovrebbe comunque stare terza. Si ordina solo dopo aver raccolto tutto.
 *
 * Il deduplice non e' teorico: fra una richiesta e l'altra il catalogo
 * puo' cambiare, e con `offset` fisso una traccia rimossa fa scalare
 * tutte le altre di uno, ripresentandone una gia' vista.
 *
 * Una posizione mancante o non numerica manda la traccia in fondo invece
 * che in testa: senza numero non sappiamo dove va, e mettercela davanti
 * sposterebbe l'apertura del disco. In fondo, e fra loro nell'ordine
 * dell'API, resta una coda leggibile — `sort` in JS e' stabile.
 */
export function orderAlbum<T extends AlbumOrderable>(pages: T[][]): T[] {
  const seen = new Set<string>();
  const flat: T[] = [];

  for (const p of pages) {
    for (const t of p) {
      if (!t.audio) continue; // niente stream: non e' riproducibile
      const key = String(t.id ?? '');
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      flat.push(t);
    }
  }

  const at = (t: T): number => {
    const n = Number(t.position);
    return Number.isFinite(n) && n > 0 ? n : Infinity;
  };
  return flat.sort((a, b) => at(a) - at(b));
}

/**
 * Jamendo restituisce i campi testuali con le entita' HTML dentro: a
 * schermo si legge `Bessonn&amp;sa` invece di `Bessonn&sa`. Misurato sul
 * catalogo vero: circa 9 tracce su 200, contro 0 su 100 di Audius — per
 * questo la decodifica sta qui e non in un punto comune.
 *
 * React Native non ha un parser HTML (niente DOM), quindi si fa a mano.
 * Una sola passata di regex, non una sostituzione per entita': decodificare
 * `&amp;` per primo trasformerebbe `&amp;lt;` in `<` invece che in `&lt;`.
 */
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  // Spazio normale, non U+00A0: in un titolo di brano lo spazio
  // unificatore non cambia niente a schermo ed e' un carattere invisibile
  // in piu' dentro dati che poi si confrontano e si copiano.
  nbsp: ' ',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== '#') return ENTITIES[body.toLowerCase()] ?? whole;

    const hex = body[1] === 'x' || body[1] === 'X';
    const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
    // Fuori intervallo o surrogato spaiato: si lascia il testo com'era,
    // che e' sempre meglio di un carattere di sostituzione.
    if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff) return whole;
    if (code >= 0xd800 && code <= 0xdfff) return whole;
    return String.fromCodePoint(code);
  });
}

/**
 * Le immagini Jamendo arrivano a 300px (`...&width=300&...`), che sul
 * player — dove l'artwork e' largo quanto lo schermo — si vede sgranato.
 * Il parametro `imagesize` della API vale pero' per l'intera risposta:
 * chiederla grande significherebbe scaricare 600px anche per le righe da
 * 48dp. La misura sta nell'URL, quindi la si riscrive.
 *
 * Verificato: `width=600` restituisce davvero un JPEG 600x600 (24 KB
 * contro 9), e 600 e' il massimo servito. Se un domani il formato dell'URL
 * cambiasse, la sostituzione non trova nulla e si torna all'immagine
 * normale: si perde la nitidezza, non l'immagine.
 */
const LARGE_WIDTH = 600;

function atLargeSize(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  return imageUrl.replace(/([?&]width=)\d+/, `$1${LARGE_WIDTH}`);
}

export function creativeCommonsLabel(licenseUrl: string | undefined): string {
  if (!licenseUrl) return 'Creative Commons';
  const match = licenseUrl.match(/creativecommons[.]org\/licenses\/([^/]+)\/([^/]+)/iu);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : 'Creative Commons';
}

function mapTrack(t: JamendoTrack): Track {
  return {
    uid: makeUid('jamendo', t.id),
    source: 'jamendo',
    id: t.id,
    title: decodeEntities(t.name),
    artist: t.artist_name ? decodeEntities(t.artist_name) : 'Sconosciuto',
    artworkUrl: t.image || t.album_image,
    artworkLargeUrl: atLargeSize(t.image || t.album_image),
    durationSec: Number(t.duration) || 0,
    streamUrl: t.audio,
    sourceUrl: t.shareurl ?? `https://www.jamendo.com/track/${t.id}`,
    rightsLabel: creativeCommonsLabel(t.license_ccurl),
    licenseUrl: t.license_ccurl,
    artistId: t.artist_id,
    albumId: t.album_id,
    albumName: t.album_name ? decodeEntities(t.album_name) : undefined,
  };
}

/**
 * Jamendo risponde 200 anche sugli errori: lo stato vero sta in `headers`.
 * Controllarlo qui evita che un errore di quota arrivi alle schermate
 * travestito da "nessun risultato".
 */
async function once<T>(requestUrl: string): Promise<T[]> {
  const res = await fetch(requestUrl);
  if (!res.ok) throw new Error(`Jamendo ha risposto ${res.status}`);
  const json = (await res.json()) as {
    headers?: { status?: string; error_message?: string };
    results?: T[];
  };
  if (json.headers?.status !== 'success') {
    throw new Error(json.headers?.error_message || 'Errore Jamendo');
  }
  return json.results ?? [];
}

/**
 * Jamendo risponde `success` con zero risultati anche quando i risultati
 * esistono: misurato circa 3 volte su 10, e non dipende dalla frequenza
 * delle chiamate (distanziarle di 1,5s non cambia nulla). Senza un secondo
 * tentativo l'app mostra schermate vuote a caso, e lo scroll infinito si
 * ferma per sempre: una pagina vuota per lui significa "fine elenco".
 *
 * Costo: un elenco davvero finito paga 3 chiamate invece di 1. Preferibile
 * a un catalogo che sparisce a intermittenza.
 */
async function fetchResults<T>(requestUrl: string): Promise<T[]> {
  for (let attempt = 0; ; attempt++) {
    const results = await once<T>(requestUrl);
    if (results.length > 0 || attempt === 2) return results;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
}

async function fetchTracks(requestUrl: string): Promise<Track[]> {
  const results = await fetchResults<JamendoTrack>(requestUrl);
  return results.filter((t) => Boolean(t.audio)).map(mapTrack);
}

export const jamendoSource: MusicSource = {
  id: 'jamendo',
  label: 'Jamendo',

  async search({ query, ...rest }: SearchParams): Promise<Track[]> {
    return fetchTracks(url('/tracks/', { search: query, ...page(rest) }));
  },

  async trending({ genre, ...rest }: TrendingParams = {}): Promise<Track[]> {
    return fetchTracks(
      url('/tracks/', {
        order: 'popularity_month',
        ...page(rest),
        ...(genre ? { tags: genre } : {}),
      }),
    );
  },

  async artistTracks(artistId: string, params: ListParams = {}): Promise<Track[]> {
    // /tracks/?artist_id= invece di /artists/tracks/: risposta piatta,
    // stesso parser e stessa gestione degli errori di tutto il resto.
    return fetchTracks(
      url('/tracks/', { artist_id: artistId, order: 'popularity_total', ...page(params) }),
    );
  },

  async artistInfo(artistId: string): Promise<ArtistInfo> {
    const [a] = await fetchResults<JamendoArtist>(url('/artists/', { id: artistId }));
    if (!a) throw new Error('Artista non trovato su Jamendo');
    return {
      id: artistId,
      source: 'jamendo',
      name: a.name ? decodeEntities(a.name) : 'Sconosciuto',
      // L'avatar e' 132dp, cioe' ~400px su questo schermo: qui la misura
      // grande serve sempre, non c'e' una lista che paghi il peso.
      imageUrl: atLargeSize(a.image),
      detail: a.joindate ? `Su Jamendo dal ${a.joindate.slice(0, 4)}` : undefined,
    };
  },

  /**
   * Un album si mostra intero, non a pagine: e' un'opera con un ordine,
   * e una raccolta troncata in silenzio a 100 tracce e' peggio di una
   * lenta. Qui si chiede il massimo per richiesta e si continua finche'
   * la pagina torna corta, poi si ordina il tutto insieme.
   *
   * `limit` e `offset` restano onorati se qualcuno li passa davvero, cosi'
   * la firma comune a tutte le sorgenti non mente; senza, si prende tutto.
   */
  async albumTracks(albumId: string, params: ListParams = {}): Promise<Track[]> {
    const size = Math.min(params.limit ?? JAMENDO_MAX_LIMIT, JAMENDO_MAX_LIMIT);
    let offset = params.offset ?? 0;
    const pages: JamendoTrack[][] = [];

    for (let i = 0; i < ALBUM_MAX_PAGES; i++) {
      // Niente `order`: /tracks/ rifiuta 'track_position' (lo accetta solo
      // /albums/tracks/, che pero' risponde annidato e vorrebbe un secondo
      // parser). La posizione arriva comunque nel campo `position`.
      const got = await fetchResults<JamendoTrack>(
        url('/tracks/', { album_id: albumId, ...page({ limit: size, offset }) }),
      );
      pages.push(got);
      // Pagina corta: e' la fine. Una pagina vuota per un guasto Jamendo
      // l'ha gia' esclusa `fetchResults`, che ritenta prima di arrendersi.
      if (got.length < size) break;
      offset += size;
      // Un limite esplicito e' una richiesta di una pagina sola.
      if (params.limit !== undefined) break;
    }

    return orderAlbum(pages).map(mapTrack);
  },

  async albumInfo(albumId: string): Promise<AlbumInfo> {
    const [a] = await fetchResults<JamendoAlbum>(url('/albums/', { id: albumId }));
    if (!a) throw new Error('Album non trovato su Jamendo');
    return {
      id: albumId,
      source: 'jamendo',
      name: a.name ? decodeEntities(a.name) : 'Senza titolo',
      artist: a.artist_name ? decodeEntities(a.artist_name) : 'Sconosciuto',
      // Copertina a 180dp: stesso ragionamento dell'avatar.
      imageUrl: atLargeSize(a.image),
      detail: a.releasedate ? a.releasedate.slice(0, 4) : undefined,
    };
  },
};
