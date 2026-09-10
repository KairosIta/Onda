/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTracksOffset } from '@/hooks/infiniteTracksCursor';
import { audiusRightsLabel, audiusTrackUrl } from '@/services/sources/audius';
import {
  MAX_SOURCE_SKIPS,
  budgetAfterPlayingChange,
  decideSkip,
  NETWORK_RETRY_DELAYS_MS,
  networkRetryDelay,
  type SkipContext,
} from '@/services/playbackPolicy';
import { combine, describeFailure, interleave } from '@/services/sources/federation';
import { REQUEST_TIMEOUT_MS, fetchJSON, timeoutMessage } from '@/services/sources/http';
import { SOURCES, searchAll, spotlightAll } from '@/services/sources';
import { creativeCommonsLabel, decodeEntities, orderAlbum } from '@/services/sources/jamendo';
import {
  buildExport,
  EXPORT_FORMAT,
  mergeLibrary,
  parseExport,
  previewImport,
} from '@/store/libraryExport';
import { loadLibrary, parseTrack } from '@/store/librarySchema';
import { loadPlaybackPrefs } from '@/store/playbackSchema';
import { toMediaItem, trackFromMediaItem } from '@/services/mediaItems';
import { BROWSE_MAX_ITEMS, buildBrowseTree } from '@/services/browseTree';
import { RECENT_QUERIES_MAX, dropQuery, loadQueries, pushQuery } from '@/utils/recentQueries';
import { dropIndex, rowShift } from '@/utils/reorder';
import { parseCollectionKind, parseEntityId } from '@/utils/routes';
import { describeUpNext, upNextLabel } from '@/utils/upNext';
import { LISTEN_THRESHOLD_SEC, listenThreshold, reachedListen } from '@/services/historyPolicy';
import { ARTWORK_MIN, artworkLayout } from '@/services/playerLayout';
import {
  BACKUP_PREFIX,
  type KeyValue,
  QUARANTINE_PREFIX,
  STORAGE_VERSION,
  VERSION_KEY,
  migrateStorage,
  quarantine,
  readStorageVersion,
} from '@/services/storageSchema';
import {
  notificationPermissionRequired,
  notificationRemedy,
  shouldRequest,
  statusFromCheck,
  statusFromRequest,
} from '@/services/notificationPolicy';
import { derivePlaybackStatus, describePlayButton } from '@/services/playbackStatus';
import {
  PROGRESS_PAUSED_MS,
  PROGRESS_PLAYING_MS,
  progressPollInterval,
} from '@/services/progressPolicy';
import {
  QUERY_CACHE_MAX_AGE_MS,
  isPersistableKey,
  loadQueryCache,
  pruneQueryCache,
} from '@/services/queryPersistenceSchema';
import {
  RESUME_TAIL_SEC,
  SESSION_MAX_AGE_MS,
  loadSavedPosition,
  loadSavedQueue,
  resumePosition,
  windowQueue,
} from '@/store/sessionSchema';
import {
  SHORT_COMMIT_LENGTH,
  compareInstalled,
  shortCommit,
  versionName,
} from './build-provenance.cjs';
import { formatTime } from '@/theme';
import type { MusicSource, SourceId, Track } from '@/types/track';
import { describeQueue } from '@/utils/queueSummary';

const track = (id: string): Track => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Traccia ${id}`,
  artist: 'Artista',
  durationSec: 120,
  streamUrl: `https://example.test/${id}.mp3`,
});

const jamendoTrack = (id: string): Track => ({
  ...track(id),
  uid: `jamendo:${id}`,
  source: 'jamendo',
});

const ok = (tracks: Track[]): PromiseSettledResult<Track[]> => ({
  status: 'fulfilled',
  value: tracks,
});

const ko = (reason: unknown): PromiseSettledResult<Track[]> => ({ status: 'rejected', reason });

test('il permalink Audius diventa sempre un collegamento canonico', () => {
  assert.equal(audiusTrackUrl('/artista/brano'), 'https://audius.co/artista/brano');
  assert.equal(
    audiusTrackUrl('https://audius.co/artista/brano'),
    'https://audius.co/artista/brano',
  );
  assert.equal(audiusTrackUrl(undefined), undefined);
});

test('le licenze delle sorgenti diventano etichette compatte', () => {
  assert.equal(audiusRightsLabel(null), 'Tutti i diritti riservati');
  assert.equal(audiusRightsLabel('Attribution-NoDerivs CC BY-ND'), 'CC BY-ND');
  assert.equal(
    creativeCommonsLabel('https://creativecommons.org/licenses/by-nc-sa/3.0/'),
    'CC BY-NC-SA 3.0',
  );
});

test('parseTrack accetta una traccia valida e rimuove campi opzionali errati', () => {
  const parsed = parseTrack({
    ...track('1'),
    sourceUrl: 'https://audius.co/artista/brano',
    rightsLabel: 'CC BY-NC',
    artworkUrl: 42,
    albumName: '',
  });
  assert.equal(parsed?.uid, 'audius:1');
  assert.equal(parsed?.sourceUrl, 'https://audius.co/artista/brano');
  assert.equal(parsed?.rightsLabel, 'CC BY-NC');
  assert.equal(parsed?.artworkUrl, undefined);
  assert.equal(parsed?.albumName, undefined);
});

test('parseTrack rifiuta uid incoerenti e dati non riproducibili', () => {
  assert.equal(parseTrack({ ...track('1'), uid: 'jamendo:1' }), undefined);
  assert.equal(parseTrack({ ...track('1'), streamUrl: '' }), undefined);
  assert.equal(parseTrack({ ...track('1'), durationSec: Number.NaN }), undefined);
});

test('loadLibrary recupera i campi sani senza conservare riferimenti orfani', () => {
  const valid = track('1');
  const loaded = loadLibrary({
    tracks: { valid, broken: { uid: 'broken' } },
    favorites: [valid.uid, valid.uid, 'audius:missing', 12],
    history: null,
    playlists: [
      { id: 'p1', name: '  Preferiti  ', createdAt: 10, trackUids: [valid.uid, 'audius:missing'] },
      { id: 'p1', name: 'Duplicata', createdAt: 11, trackUids: [] },
      { id: 2, name: 'Non valida', createdAt: 12, trackUids: [] },
    ],
  });

  assert.deepEqual(loaded.favorites, [valid.uid]);
  assert.deepEqual(loaded.history, []);
  assert.deepEqual(loaded.playlists, [
    { id: 'p1', name: 'Preferiti', createdAt: 10, trackUids: [valid.uid] },
  ]);
  assert.deepEqual(Object.keys(loaded.tracks), [valid.uid]);
});

test('loadLibrary limita la cronologia a cento tracce', () => {
  const tracks = Object.fromEntries(
    Array.from({ length: 105 }, (_, i) => {
      const item = track(String(i));
      return [item.uid, item];
    }),
  );
  const history = Object.keys(tracks);
  assert.equal(loadLibrary({ tracks, history }).history.length, 100);
});

test('il cursore termina su una pagina vuota completa', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 0, failedCount: 0 }, 20), undefined);
});

test('il cursore riprova una pagina parziale senza saltare risultati', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 20, failedCount: 1 }, 20), 40);
});

test('il cursore avanza dopo una pagina completa', () => {
  assert.equal(nextTracksOffset({ offset: 40, trackCount: 40, failedCount: 0 }, 20), 60);
});

const repeatModes = { off: 'off', one: 'one', all: 'all' } as const;

test('le preferenze playback partono con valori sicuri', () => {
  assert.deepEqual(loadPlaybackPrefs(undefined, repeatModes), { shuffle: false, repeat: 'off' });
  assert.deepEqual(loadPlaybackPrefs({ shuffle: 'si', repeat: 'sconosciuto' }, repeatModes), {
    shuffle: false,
    repeat: 'off',
  });
});

test('le preferenze playback conservano il formato corrente', () => {
  assert.deepEqual(loadPlaybackPrefs({ shuffle: true, repeat: 'one' }, repeatModes), {
    shuffle: true,
    repeat: 'one',
  });
});

test('le preferenze playback migrano i vecchi repeat numerici', () => {
  assert.equal(loadPlaybackPrefs({ repeat: 0 }, repeatModes).repeat, 'off');
  assert.equal(loadPlaybackPrefs({ repeat: 1 }, repeatModes).repeat, 'one');
  assert.equal(loadPlaybackPrefs({ repeat: 2 }, repeatModes).repeat, 'all');
});

test('le entita HTML di Jamendo si decodificano in una sola passata', () => {
  assert.equal(decodeEntities('Bessonn&amp;sa'), 'Bessonn&sa');
  assert.equal(decodeEntities('&lt;tag&gt; &quot;x&quot; &apos;y&apos;'), '<tag> "x" \'y\'');
  // Lo spazio unificatore diventa uno spazio normale: invisibile a schermo,
  // ma un carattere in meno dentro dati che poi si confrontano.
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(decodeEntities('&#233;&#x1F600;'), 'é😀');
  // Una passata sola: decodificare &amp; per primo darebbe '<' invece di '&lt;'.
  assert.equal(decodeEntities('&amp;lt;'), '&lt;');
});

test('decodeEntities lascia intatto cio che non sa decodificare', () => {
  assert.equal(decodeEntities('100% & via'), '100% & via');
  assert.equal(decodeEntities('&nonesiste;'), '&nonesiste;');
  // Fuori intervallo Unicode e surrogato spaiato: meglio il testo originale
  // di un carattere di sostituzione.
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;');
  assert.equal(decodeEntities('&#xD800;'), '&#xD800;');
  assert.equal(decodeEntities('&#0;'), '&#0;');
});

test('la federazione alterna le sorgenti invece di concatenarle', () => {
  const merged = interleave([
    [track('a1'), track('a2'), track('a3')],
    [jamendoTrack('j1'), jamendoTrack('j2')],
  ]);
  assert.deepEqual(
    merged.map((t) => t.uid),
    ['audius:a1', 'jamendo:j1', 'audius:a2', 'jamendo:j2', 'audius:a3'],
  );
  assert.deepEqual(interleave([]), []);
});

test('i guasti di rete si riducono a un messaggio solo, gli altri restano interi', () => {
  const android = new Error(
    'fetch failed: java.net.UnknownHostException: Unable to resolve host "api.audius.co"',
  );
  assert.equal(describeFailure(android), 'rete non raggiungibile');
  assert.equal(describeFailure(new Error('Network request failed')), 'rete non raggiungibile');
  // Quota esaurita o API cambiata: e' esattamente cio che si vuole leggere.
  assert.equal(describeFailure(new Error('Jamendo ha risposto 429')), 'Jamendo ha risposto 429');
  assert.equal(describeFailure(new Error('')), 'errore sconosciuto');
  assert.equal(describeFailure(undefined), 'errore sconosciuto');
});

test('una sorgente caduta lascia comunque un risultato utilizzabile', () => {
  const result = combine([
    { source: 'audius', result: ok([track('a1')]) },
    { source: 'jamendo', result: ko(new Error('Jamendo ha risposto 429')) },
  ]);
  assert.deepEqual(
    result.tracks.map((t) => t.uid),
    ['audius:a1'],
  );
  assert.deepEqual(result.failed, [{ source: 'jamendo', message: 'Jamendo ha risposto 429' }]);
});

test('una caduta totale e un errore, non un catalogo finito', () => {
  // Tornare { tracks: [], failed } chiuderebbe per sempre lo scroll infinito:
  // una pagina vuota per il cursore significa "fine elenco".
  assert.throws(
    () =>
      combine([
        { source: 'audius', result: ko(new Error('fetch failed')) },
        { source: 'jamendo', result: ko(new Error('fetch failed')) },
      ]),
    // Stesso motivo per entrambe: si dice una volta sola.
    { message: 'rete non raggiungibile' },
  );

  assert.throws(
    () =>
      combine([
        { source: 'audius', result: ko(new Error('fetch failed')) },
        { source: 'jamendo', result: ko(new Error('Jamendo ha risposto 429')) },
      ]),
    { message: 'audius: rete non raggiungibile · jamendo: Jamendo ha risposto 429' },
  );
});

test('una pagina vuota da tutte le sorgenti resta una fine elenco legittima', () => {
  const result = combine([
    { source: 'audius', result: ok([]) },
    { source: 'jamendo', result: ok([]) },
  ]);
  assert.deepEqual(result, { tracks: [], failed: [] });
  // Nessuna sorgente registrata: niente da segnalare, niente da lanciare.
  assert.deepEqual(combine([]), { tracks: [], failed: [] });
});

/** Coda di dieci brani, fermi sul primo: c'e' sempre un successivo. */
const inCoda = (over: Partial<SkipContext> = {}): SkipContext => ({
  code: 'source',
  skipsUsed: 0,
  queue: () => ({ index: 0, length: 10 }),
  ...over,
});

test('gli errori recuperabili non consumano il budget di salti', () => {
  // Non basta che non si salti: il modulo nativo non va nemmeno interrogato,
  // ed e' l'ordine che il gestore aveva prima dell'estrazione.
  let letture = 0;
  const queue = () => {
    letture++;
    return { index: 0, length: 10 };
  };
  assert.equal(decideSkip(inCoda({ code: 'network', queue })), 'ignora');
  assert.equal(decideSkip(inCoda({ code: 'play-not-permitted', queue })), 'ignora');
  assert.equal(letture, 0);
});

test('un brano illeggibile si salta, ma non oltre la fine della coda', () => {
  assert.equal(decideSkip(inCoda()), 'salta');
  assert.equal(decideSkip(inCoda({ code: 'renderer' })), 'salta');
  assert.equal(decideSkip(inCoda({ code: 'unknown' })), 'salta');

  // Ultimo elemento: non c'e' un successivo a cui passare.
  assert.equal(decideSkip(inCoda({ queue: () => ({ index: 9, length: 10 }) })), 'fermati');
  // Posizione ignota: meglio fermarsi che saltare alla cieca.
  assert.equal(decideSkip(inCoda({ queue: () => ({ index: null, length: 10 }) })), 'fermati');
});

test('il budget di salti si esaurisce dopo tre brani rotti di fila', () => {
  for (let usati = 0; usati < MAX_SOURCE_SKIPS; usati++) {
    assert.equal(decideSkip(inCoda({ skipsUsed: usati })), 'salta');
  }
  assert.equal(decideSkip(inCoda({ skipsUsed: MAX_SOURCE_SKIPS })), 'fermati');
});

test('una riproduzione riuscita ricarica il budget, una pausa no', () => {
  assert.equal(budgetAfterPlayingChange(true, MAX_SOURCE_SKIPS), 0);
  assert.equal(budgetAfterPlayingChange(true, 0), 0);
  // In pausa il budget resta com'e': la pausa non dimostra che qualcosa suoni.
  assert.equal(budgetAfterPlayingChange(false, 2), 2);
});

test('il budget conta i fallimenti consecutivi, non quelli di tutta la sessione', () => {
  // La regressione sotto esame: prima il budget era per processo, quindi
  // dopo tre salti sparsi la coda restava bloccata per sempre.
  let usati = 0;
  const salta = (): boolean => {
    const decisione = decideSkip(inCoda({ skipsUsed: usati }));
    if (decisione === 'salta') usati++;
    return decisione === 'salta';
  };

  assert.deepEqual([salta(), salta(), salta()], [true, true, true]);
  assert.equal(salta(), false, 'quarto brano rotto di fila: ci si ferma');

  // Un brano suona davvero: il budget torna pieno e la coda riprende.
  usati = budgetAfterPlayingChange(true, usati);
  assert.equal(usati, 0);
  assert.equal(salta(), true, 'dopo una riproduzione riuscita si riparte');
});

test('formatTime mostra le ore solo quando ci sono', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9), '0:09');
  assert.equal(formatTime(187), '3:07');
  assert.equal(formatTime(3599), '59:59', 'un secondo prima dell ora resta in minuti');
  assert.equal(formatTime(3600), '1:00:00', 'l ora esatta fa comparire il campo ore');
  assert.equal(formatTime(3665), '1:01:05');
  assert.equal(formatTime(7525), '2:05:25', 'il caso della voce TODO: non 125:25');
});

test('formatTime regge durate reali e valori impossibili', () => {
  // Le due tracce del trending Audius che mostravano 61:51 e 70:01.
  assert.equal(formatTime(3711), '1:01:51');
  assert.equal(formatTime(4201), '1:10:01');
  // La radio da 59:35 del collaudo timer resta senza campo ore.
  assert.equal(formatTime(3575), '59:35');
  // I decimali si troncano, non arrotondano: la barra non deve mai
  // annunciare una durata che il player non raggiunge.
  assert.equal(formatTime(59.9), '0:59');
  for (const brutto of [NaN, Infinity, -Infinity, -1]) {
    assert.equal(formatTime(brutto), '0:00', `${brutto} non deve produrre NaN a schermo`);
  }
});

/** Traccia Jamendo ridotta al minimo che serve a ordinare un album. */
const brano = (id: string, position?: number | string, audio = 'https://x/a.mp3') => ({
  id,
  position,
  audio,
});

test('un album oltre le cento tracce si ricompone nell ordine del disco', () => {
  // Due pagine da 200 e una corta: 250 tracce, numerate a rovescio dentro
  // ogni pagina per assicurarsi che l ordine non venga dall API.
  const pagine = [
    Array.from({ length: 200 }, (_, i) => brano(`t${200 - i}`, 200 - i)),
    Array.from({ length: 50 }, (_, i) => brano(`t${250 - i}`, 250 - i)),
  ];

  const album = orderAlbum(pagine);
  assert.equal(album.length, 250, 'nessuna traccia persa oltre la prima pagina');
  assert.deepEqual(
    album.slice(0, 3).map((t) => t.id),
    ['t1', 't2', 't3'],
  );
  assert.equal(album[249].id, 't250', 'la traccia 250 chiude il disco');
  assert.deepEqual(
    album.map((t) => Number(t.position)),
    Array.from({ length: 250 }, (_, i) => i + 1),
    'posizioni consecutive attraverso il confine di pagina',
  );
});

test('un album ricompone pagine che si sovrappongono senza duplicare', () => {
  // Il catalogo cambia fra due richieste: con offset fisso la traccia 3
  // ritorna nella pagina successiva.
  const album = orderAlbum([
    [brano('a', 1), brano('b', 2), brano('c', 3)],
    [brano('c', 3), brano('d', 4)],
  ]);
  assert.deepEqual(
    album.map((t) => t.id),
    ['a', 'b', 'c', 'd'],
  );
});

test('orderAlbum scarta cio che non e riproducibile e non scombina il resto', () => {
  const album = orderAlbum([[brano('a', 1), brano('muto', 2, ''), brano('c', 3)]]);
  assert.deepEqual(
    album.map((t) => t.id),
    ['a', 'c'],
    'una traccia senza stream non deve lasciare un buco navigabile',
  );
});

test('le tracce senza posizione valida finiscono in fondo, nell ordine dell API', () => {
  const album = orderAlbum([
    [brano('senza'), brano('due', 2), brano('rotta', 'boh'), brano('uno', 1), brano('zero', 0)],
  ]);
  assert.deepEqual(
    album.map((t) => t.id),
    ['uno', 'due', 'senza', 'rotta', 'zero'],
    'chi dichiara una posizione apre il disco; gli altri restano stabili in coda',
  );
});

test('senza shuffle la coda conta i brani che restano davvero', () => {
  const s = describeQueue({ length: 40, activeIndex: 8, shuffle: false });
  assert.equal(s.subtitle, '31 brani dopo questo');
  assert.equal(s.clearLabel, 'Svuota i successivi');
  assert.equal(s.dimPlayed, true, 'l indice canonico e davvero l ordine di ascolto');
  assert.equal(s.notice, undefined, 'niente da avvertire: l elenco e l ordine');

  assert.equal(
    describeQueue({ length: 2, activeIndex: 0, shuffle: false }).subtitle,
    '1 brano dopo questo',
  );
  const ultimo = describeQueue({ length: 40, activeIndex: 39, shuffle: false });
  assert.equal(ultimo.subtitle, 'Ultimo brano');
  assert.equal(ultimo.clearLabel, undefined, 'niente sotto: niente da svuotare');
});

test('con shuffle la coda dichiara di non essere l ordine di ascolto', () => {
  // Il caso misurato il 30 agosto 2026: 40 brani, indice attivo 8, uno solo
  // riprodotto. Prima diceva «31 brani dopo questo» e ne attenuava 8.
  const s = describeQueue({ length: 40, activeIndex: 8, shuffle: true });
  assert.equal(s.subtitle, '40 brani in coda · ordine casuale');
  assert.ok(s.notice, 'l avvertenza e la meta che rende la schermata onesta');
  assert.equal(s.dimPlayed, false, 'attenuare le prime 8 inventerebbe un ascolto mai avvenuto');
  assert.equal(s.clearLabel, 'Svuota da qui in giù');
});

test('con shuffle sull ultima riga non resta niente da svuotare', () => {
  const s = describeQueue({ length: 40, activeIndex: 39, shuffle: true });
  assert.equal(s.clearLabel, undefined);
  assert.equal(
    s.subtitle,
    '40 brani in coda · ordine casuale',
    'il totale non dipende dalla posizione',
  );
  assert.ok(s.notice, 'l ordine resta ignoto anche sull ultima riga dell elenco');
});

test('una coda vuota non annuncia niente e non offre azioni', () => {
  for (const shuffle of [false, true]) {
    const s = describeQueue({ length: 0, activeIndex: null, shuffle });
    assert.equal(s.subtitle, '');
    assert.equal(s.clearLabel, undefined);
    assert.equal(s.notice, undefined);
  }
});

test('con posizione ignota la coda non finge di sapere dove siamo', () => {
  // Coda carica ma nessuna traccia attiva: non esiste un "questo" a cui
  // riferirsi, e lo svuotamento taglierebbe da un indice inesistente.
  const s = describeQueue({ length: 5, activeIndex: null, shuffle: false });
  assert.equal(s.subtitle, '5 brani in coda');
  assert.equal(s.clearLabel, undefined, 'il pulsante non farebbe niente');
  assert.equal(s.dimPlayed, false);

  const casuale = describeQueue({ length: 5, activeIndex: null, shuffle: true });
  assert.match(casuale.subtitle, /ordine casuale/);
  assert.ok(casuale.notice, 'l avviso sullo shuffle resta dovuto');
  assert.equal(casuale.clearLabel, undefined);
});

// --- export/import della libreria ------------------------------------

const traccia = (id: string, extra: Record<string, unknown> = {}) => ({
  uid: `audius:${id}`,
  source: 'audius',
  id,
  title: `Brano ${id}`,
  artist: 'Tizio',
  durationSec: 100,
  streamUrl: `https://x/${id}`,
  ...extra,
});

const libreria = (over: Record<string, unknown> = {}) =>
  loadLibrary({ tracks: {}, favorites: [], playlists: [], history: [], ...over });

const conTracce = (ids: string[], over: Record<string, unknown> = {}) =>
  libreria({
    tracks: Object.fromEntries(ids.map((i) => [`audius:${i}`, traccia(i)])),
    ...over,
  });

test('un export si rilegge identico', () => {
  const originale = conTracce(['a', 'b'], {
    favorites: ['audius:a'],
    playlists: [{ id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:b'] }],
    history: ['audius:b'],
  });

  const file = JSON.stringify(buildExport(originale, 1234));
  const letto = parseExport(file);
  assert.equal(letto.ok, true);
  assert.ok(letto.ok);
  assert.deepEqual(letto.library, originale, 'round-trip senza perdite');
  assert.equal(JSON.parse(file).exportedAt, 1234);
  assert.equal(JSON.parse(file).format, EXPORT_FORMAT);
});

test('un file estraneo viene rifiutato invece che svuotato', () => {
  // Senza il controllo di formato, loadLibrary "riparerebbe" qualunque
  // JSON in una libreria vuota e l import sembrerebbe riuscito.
  for (const brutto of ['{"tracks":{}}', '[]', 'non json', '{"format":"altro","version":1}']) {
    const r = parseExport(brutto);
    assert.equal(r.ok, false, `${brutto} non deve passare`);
    assert.ok(!r.ok && r.reason.length > 0, 'un rifiuto deve dire perche');
  }
});

test('un export da una versione futura si rifiuta, uno vecchio si legge', () => {
  const futuro = parseExport({ format: EXPORT_FORMAT, version: 99, library: {} });
  assert.equal(futuro.ok, false);
  assert.ok(!futuro.ok && futuro.reason.includes('99'));

  const vecchio = parseExport({ format: EXPORT_FORMAT, version: 1, library: {} });
  assert.equal(vecchio.ok, true);
});

test('la fusione non toglie mai niente a chi importa', () => {
  const mia = conTracce(['a'], { favorites: ['audius:a'] });
  const sua = conTracce(['b'], { favorites: ['audius:b'] });

  const esito = mergeLibrary(mia, sua);
  assert.deepEqual(esito.favorites, ['audius:a', 'audius:b'], 'i miei restano davanti');
  assert.deepEqual(Object.keys(esito.tracks).sort(), ['audius:a', 'audius:b']);
});

test('le playlist si uniscono per id senza duplicarsi', () => {
  const mia = conTracce(['a', 'b'], {
    playlists: [{ id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:a'] }],
  });
  const sua = conTracce(['a', 'b', 'c'], {
    playlists: [
      // stesso id: reimportare un export sullo stesso dispositivo
      { id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:a', 'audius:b'] },
      // id nuovo: arriva da un altra installazione
      { id: 'p2', name: 'Corsa', createdAt: 2, trackUids: ['audius:c'] },
    ],
  });

  const esito = mergeLibrary(mia, sua);
  assert.equal(esito.playlists.length, 2, 'p1 non viene duplicata');
  const p1 = esito.playlists.find((p) => p.id === 'p1');
  assert.deepEqual(p1?.trackUids, ['audius:a', 'audius:b'], 'unione, senza ripetere audius:a');
  assert.equal(esito.playlists.find((p) => p.id === 'p2')?.name, 'Corsa');
});

test('reimportare lo stesso export due volte non cambia niente', () => {
  const mia = conTracce(['a', 'b'], {
    favorites: ['audius:a'],
    playlists: [{ id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:b'] }],
    history: ['audius:a'],
  });
  const file = parseExport(JSON.stringify(buildExport(mia)));
  assert.ok(file.ok);

  const una = mergeLibrary(mia, file.library);
  const due = mergeLibrary(una, file.library);
  assert.deepEqual(una, mia, 'idempotente gia al primo giro');
  assert.deepEqual(due, una, 'e anche al secondo');
});

test('sui metadati vince la copia gia in libreria, non quella del file', () => {
  // La mia e stata rivista dalla sorgente; quella del file e vecchia
  // quanto l export.
  const mia = libreria({ tracks: { 'audius:a': traccia('a', { title: 'Titolo nuovo' }) } });
  const sua = libreria({ tracks: { 'audius:a': traccia('a', { title: 'Titolo vecchio' }) } });
  mia.favorites = ['audius:a'];
  sua.favorites = ['audius:a'];

  const esito = mergeLibrary(mia, sua);
  assert.equal(esito.tracks['audius:a'].title, 'Titolo nuovo');
});

test('la fusione scarta i riferimenti che il file non risolve', () => {
  const mia = libreria();
  // Preferito senza la traccia corrispondente: un file troncato.
  const sua = { ...libreria(), favorites: ['audius:fantasma'] };

  const esito = mergeLibrary(mia, sua);
  assert.deepEqual(esito.favorites, [], 'niente uid orfani nello stato finale');
});

test('la cronologia fusa resta entro il tetto', () => {
  const ids = Array.from({ length: 80 }, (_, i) => `t${i}`);
  const altri = Array.from({ length: 80 }, (_, i) => `u${i}`);
  const mia = conTracce(ids, { history: ids.map((i) => `audius:${i}`) });
  const sua = conTracce(altri, { history: altri.map((i) => `audius:${i}`) });

  const esito = mergeLibrary(mia, sua);
  assert.equal(esito.history.length, 100, 'tagliata al tetto, non 160');
  assert.equal(esito.history[0], 'audius:t0', 'la mia cronologia resta in testa');
});

test('a cronologia piena l anteprima non promette voci che non entrano', () => {
  // Il tetto e' 100: la mia cronologia lo occupa gia' tutto, quindi le
  // voci del file non hanno dove andare. L'anteprima deve dirlo, invece
  // di contarle e far confermare un import che non cambia niente.
  const miei = Array.from({ length: 100 }, (_, i) => `t${i}`);
  const suoi = Array.from({ length: 10 }, (_, i) => `u${i}`);
  const mia = conTracce(miei, { history: miei.map((i) => `audius:${i}`) });
  const sua = conTracce(suoi, { history: suoi.map((i) => `audius:${i}`) });

  const p = previewImport(mia, sua);
  const dopo = mergeLibrary(mia, sua);
  assert.equal(p.newHistory, 0, 'nessuna voce entra: il tetto e pieno');
  assert.deepEqual(dopo.history, mia.history, 'e infatti la cronologia non cambia');
  assert.equal(p.newTracks, 10, 'le tracce pero entrano nel catalogo');
});

test('l anteprima conta solo la cronologia che ci sta davvero', () => {
  // Restano tre posti liberi e il file ne porta dieci: tre.
  const miei = Array.from({ length: 97 }, (_, i) => `t${i}`);
  const suoi = Array.from({ length: 10 }, (_, i) => `u${i}`);
  const mia = conTracce(miei, { history: miei.map((i) => `audius:${i}`) });
  const sua = conTracce(suoi, { history: suoi.map((i) => `audius:${i}`) });

  const p = previewImport(mia, sua);
  const dopo = mergeLibrary(mia, sua);
  assert.equal(p.newHistory, 3);
  assert.equal(dopo.history.length, 100);
});

test('un file che porta solo cronologia gia piena non e da importare', () => {
  const miei = Array.from({ length: 100 }, (_, i) => `t${i}`);
  const mia = conTracce(miei, { history: miei.map((i) => `audius:${i}`) });
  // Stesse tracce, stessa cronologia: non c'e' nemmeno un brano nuovo.
  const p = previewImport(mia, mia);
  assert.equal(p.empty, true, 'altrimenti il pulsante Importa resta attivo a vuoto');
});

test('l anteprima dice cosa entra prima di farlo entrare', () => {
  const mia = conTracce(['a'], {
    favorites: ['audius:a'],
    playlists: [{ id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:a'] }],
  });
  const sua = conTracce(['a', 'b', 'c'], {
    favorites: ['audius:a', 'audius:b'],
    playlists: [
      { id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:a', 'audius:b'] },
      { id: 'p2', name: 'Corsa', createdAt: 2, trackUids: ['audius:c'] },
    ],
    history: ['audius:c'],
  });

  const p = previewImport(mia, sua);
  assert.equal(p.newFavorites, 1);
  assert.equal(p.newPlaylists, 1, 'solo p2 e nuova');
  assert.equal(p.grownPlaylists, 1, 'p1 cresce di una traccia');
  assert.equal(p.newTracks, 2);
  assert.equal(p.newHistory, 1);
  assert.equal(p.empty, false);

  assert.equal(previewImport(mia, mia).empty, true, 'importare se stessi non aggiunge nulla');
});

// --- sessione di ascolto ----------------------------------------------

const NOW = 1_700_000_000_000;

const codaSalvata = (ids: string[], index: number, over: Record<string, unknown> = {}) => ({
  tracks: ids.map(track),
  index,
  savedAt: NOW - 60_000,
  ...over,
});

test('una coda corta si salva intera, una lunga come finestra intorno al brano attivo', () => {
  const corta = [track('a'), track('b'), track('c')];
  assert.deepEqual(windowQueue(corta, 1, 200), { tracks: corta, index: 1 });

  const lunga = Array.from({ length: 300 }, (_, i) => track(String(i)));
  const w = windowQueue(lunga, 150, 200);
  assert.equal(w.tracks.length, 200);
  assert.equal(w.tracks[w.index]?.uid, 'audius:150', 'il brano attivo resta quello');
  assert.equal(w.index, 50, 'un quarto della finestra sta prima del brano attivo');
  assert.equal(w.tracks[0]?.uid, 'audius:100');

  const inizio = windowQueue(lunga, 3, 200);
  assert.equal(inizio.index, 3, 'vicino all inizio la finestra parte da zero');
  assert.equal(inizio.tracks[0]?.uid, 'audius:0');

  const fine = windowQueue(lunga, 299, 200);
  assert.equal(
    fine.tracks.at(-1)?.uid,
    'audius:299',
    'vicino alla fine la finestra arriva in fondo',
  );
  assert.equal(fine.tracks[fine.index]?.uid, 'audius:299');
});

test('la coda salvata torna intera quando e sana', () => {
  const q = loadSavedQueue(codaSalvata(['a', 'b', 'c'], 1), NOW);
  assert.ok(q);
  assert.equal(q.tracks.length, 3);
  assert.equal(q.tracks[q.index]?.uid, 'audius:b');
});

test('un brano corrotto si scarta senza spostare quello attivo', () => {
  const raw = codaSalvata(['a', 'b', 'c'], 2);
  raw.tracks[0] = { uid: 'rotto' } as never;
  const q = loadSavedQueue(raw, NOW);
  assert.ok(q);
  assert.equal(q.tracks.length, 2);
  assert.equal(q.tracks[q.index]?.uid, 'audius:c', 'l indice segue il brano, non la posizione');
});

test('senza un brano attivo valido non c e niente da riprendere', () => {
  const raw = codaSalvata(['a', 'b'], 1);
  raw.tracks[1] = { uid: 'rotto' } as never;
  assert.equal(loadSavedQueue(raw, NOW), null, 'attivo corrotto');
  assert.equal(loadSavedQueue(codaSalvata(['a', 'b'], 5), NOW), null, 'indice fuori coda');
  assert.equal(loadSavedQueue(codaSalvata(['a'], 0, { index: 'x' }), NOW), null);
  assert.equal(loadSavedQueue(codaSalvata([], 0), NOW), null, 'coda vuota');
  assert.equal(loadSavedQueue(null, NOW), null);
  assert.equal(loadSavedQueue('coda', NOW), null);
});

test('una coda di un mese fa e un ricordo, non una sessione', () => {
  const vecchia = codaSalvata(['a'], 0, { savedAt: NOW - SESSION_MAX_AGE_MS - 1 });
  assert.equal(loadSavedQueue(vecchia, NOW), null);
  const senzaData = codaSalvata(['a'], 0, { savedAt: undefined });
  assert.equal(loadSavedQueue(senzaData, NOW), null);
  assert.ok(loadSavedQueue(codaSalvata(['a'], 0, { savedAt: NOW - SESSION_MAX_AGE_MS }), NOW));
});

test('la posizione salvata vale solo se e un numero sensato', () => {
  assert.deepEqual(loadSavedPosition({ uid: 'audius:a', position: 42.5, savedAt: 7 }), {
    uid: 'audius:a',
    position: 42.5,
    savedAt: 7,
  });
  assert.equal(loadSavedPosition({ uid: 'audius:a', position: -1 }), null);
  assert.equal(loadSavedPosition({ uid: 'audius:a', position: Number.NaN }), null);
  assert.equal(loadSavedPosition({ uid: '', position: 3 }), null);
  assert.equal(loadSavedPosition(undefined), null);
});

test('si riprende dalla posizione solo se appartiene al brano attivo', () => {
  const q = loadSavedQueue(codaSalvata(['a', 'b'], 1), NOW)!;
  assert.equal(resumePosition(q, { uid: 'audius:b', position: 30, savedAt: 0 }), 30);
  assert.equal(resumePosition(q, { uid: 'audius:a', position: 30, savedAt: 0 }), 0, 'altro brano');
  assert.equal(resumePosition(q, null), 0);
});

test('sui titoli di coda si riparte da capo', () => {
  const q = loadSavedQueue(codaSalvata(['a'], 0), NOW)!; // durationSec: 120
  const quasiFine = 120 - RESUME_TAIL_SEC;
  assert.equal(resumePosition(q, { uid: 'audius:a', position: quasiFine, savedAt: 0 }), 0);
  assert.equal(
    resumePosition(q, { uid: 'audius:a', position: quasiFine - 1, savedAt: 0 }),
    quasiFine - 1,
  );

  // Durata ignota: non si puo' dire dove sia la fine, la posizione resta.
  const ignota = loadSavedQueue(
    codaSalvata(['a'], 0, { tracks: [{ ...track('a'), durationSec: 0 }] }),
    NOW,
  )!;
  assert.equal(resumePosition(ignota, { uid: 'audius:a', position: 500, savedAt: 0 }), 500);
});

test('un elemento della coda RNTP torna al nostro modello', () => {
  const t = track('a');
  assert.deepEqual(trackFromMediaItem(toMediaItem(t)), t, 'la copia in extras vince');

  // Un elemento non nostro: si ricostruisce il minimo dall uid.
  const estraneo = trackFromMediaItem({
    mediaId: 'jamendo:9',
    url: 'https://x/9.mp3',
    title: 'Nove',
    artist: 'Qualcuno',
    duration: 61,
  });
  assert.equal(estraneo?.source, 'jamendo');
  assert.equal(estraneo?.id, '9');
  assert.equal(estraneo?.streamUrl, 'https://x/9.mp3');
  assert.equal(estraneo?.durationSec, 61);

  assert.equal(trackFromMediaItem({ url: 'https://x' }), null, 'senza uid non e un brano');
});

// --- stato del player ---------------------------------------------------

test('lo stato del tasto play segue una tabella sola', () => {
  const s = (
    state: string,
    playing: boolean,
    over: Partial<Parameters<typeof derivePlaybackStatus>[0]> = {},
  ) =>
    derivePlaybackStatus({ state, playing, hasItem: true, pending: false, fault: false, ...over });

  assert.equal(s('ready', true), 'playing');
  assert.equal(s('ready', false), 'paused');
  assert.equal(s('buffering', false), 'buffering');
  assert.equal(s('error', false), 'error');
  assert.equal(s('ended', false), 'ended');
  assert.equal(s('idle', false), 'paused', 'un brano caricato ma mai preparato e in pausa');
  assert.equal(
    s('idle', false, { fault: true }),
    'error',
    'su Android lo stato error non arriva mai: dopo un errore il player e idle',
  );
  assert.equal(s('ready', true, { hasItem: false }), 'idle', 'senza brano non c e stato');
  assert.equal(
    s('idle', false, { hasItem: false, pending: true }),
    'paused',
    'la coda in attesa e una pausa',
  );
});

test('il tasto play e occupato solo durante il caricamento', () => {
  assert.equal(describePlayButton('buffering').busy, true);
  assert.equal(describePlayButton('buffering').icon, 'pause', 'toccare lo spinner ferma');
  for (const status of ['idle', 'playing', 'paused', 'ended', 'error'] as const) {
    assert.equal(describePlayButton(status).busy, false, status);
  }
  assert.equal(describePlayButton('error').icon, 'refresh');
  assert.equal(describePlayButton('playing').icon, 'pause');
  assert.equal(describePlayButton('paused').icon, 'play');
});

test('il progresso si legge solo quando qualcuno guarda e c e qualcosa da guardare', () => {
  const base = { subscribers: 1, hasTrack: true, appActive: true, playing: true };
  assert.equal(progressPollInterval(base), PROGRESS_PLAYING_MS);
  assert.equal(progressPollInterval({ ...base, playing: false }), PROGRESS_PAUSED_MS);
  assert.equal(progressPollInterval({ ...base, subscribers: 0 }), null, 'nessun lettore');
  assert.equal(progressPollInterval({ ...base, hasTrack: false }), null, 'nessun brano');
  assert.equal(progressPollInterval({ ...base, appActive: false }), null, 'app in background');
  assert.ok(PROGRESS_PAUSED_MS > PROGRESS_PLAYING_MS);
});

// --- cache di React Query su disco ------------------------------------

const query = (root: string, age: number, over: Record<string, unknown> = {}) => ({
  queryKey: [root, 'x'],
  queryHash: `["${root}","x"]`,
  state: { status: 'success', dataUpdatedAt: NOW - age, data: { ok: true }, ...over },
});

test('solo le chiavi degli elenchi che si riaprono finiscono su disco', () => {
  assert.equal(isPersistableKey(['trending', 'all']), true);
  assert.equal(isPersistableKey(['artist-tracks', 'audius', '1']), true);
  assert.equal(isPersistableKey(['search', 'yellow']), false, 'la casella e vuota all avvio');
  assert.equal(isPersistableKey([]), false);
});

test('la potatura tiene le query riuscite, recenti e persistibili, le piu fresche prime', () => {
  const stato = {
    queries: [
      query('trending', 5_000),
      query('search', 1_000),
      query('artist', 2_000, { status: 'pending', data: undefined }),
      query('album', QUERY_CACHE_MAX_AGE_MS + 1),
      query('album-tracks', 1),
    ],
    mutations: [{ id: 1 }],
  };
  const out = pruneQueryCache(stato, { now: NOW });
  assert.deepEqual(
    out.queries.map((q) => q.queryKey[0]),
    ['album-tracks', 'trending'],
  );
  assert.deepEqual(out.mutations, [], 'le mutazioni non si persistono');
});

test('la potatura limita il numero di query e le pagine degli elenchi infiniti', () => {
  const tante = Array.from({ length: 10 }, (_, i) => query('trending', i * 1000));
  assert.equal(
    pruneQueryCache({ queries: tante, mutations: [] }, { now: NOW, maxQueries: 3 }).queries.length,
    3,
  );

  const infinita = query('trending', 0, {
    data: { pages: [{ offset: 0 }, { offset: 20 }, { offset: 40 }], pageParams: [0, 20, 40] },
  });
  const [potata] = pruneQueryCache(
    { queries: [infinita], mutations: [] },
    { now: NOW, maxPages: 2 },
  ).queries;
  assert.deepEqual(potata?.state.data, {
    pages: [{ offset: 0 }, { offset: 20 }],
    pageParams: [0, 20],
  });

  // Una query normale non ha pagine e passa intatta.
  const semplice = query('album', 0, { data: { name: 'Disco' } });
  const [intatta] = pruneQueryCache(
    { queries: [semplice], mutations: [] },
    { now: NOW, maxPages: 1 },
  ).queries;
  assert.deepEqual(intatta?.state.data, { name: 'Disco' });
});

test('il file della cache si rilegge solo se ha la forma giusta e qualcosa dentro', () => {
  assert.equal(loadQueryCache(undefined, NOW), null);
  assert.equal(loadQueryCache({ queries: 'no' }, NOW), null);
  assert.equal(loadQueryCache({ queries: [{ queryKey: ['trending'] }] }, NOW), null, 'senza stato');
  // Senza `queryHash` React Query non ritroverebbe la query: la voce si scarta.
  const { queryHash: _via, ...senzaHash } = query('trending', 10);
  assert.equal(loadQueryCache({ queries: [senzaHash] }, NOW), null, 'senza queryHash');
  assert.equal(
    loadQueryCache({ queries: [query('search', 0)] }, NOW),
    null,
    'niente di persistibile',
  );

  const letto = loadQueryCache({ queries: [query('trending', 10), { rotta: true }] }, NOW);
  assert.equal(letto?.queries.length, 1);
  assert.deepEqual(letto?.mutations, []);
});

// --- ricerche recenti ------------------------------------------------

test('le ricerche recenti salgono in testa senza doppioni', () => {
  let list: string[] = [];
  list = pushQuery(list, 'lofi');
  list = pushQuery(list, '  jazz  ');
  list = pushQuery(list, 'LoFi');
  assert.deepEqual(list, ['LoFi', 'jazz'], 'la stessa parola con altre maiuscole risale');
  assert.equal(pushQuery(list, '   '), list, 'una ricerca vuota non tocca la lista');
  assert.deepEqual(dropQuery(list, 'jazz'), ['LoFi']);
});

test('le ricerche recenti restano poche', () => {
  let list: string[] = [];
  for (let i = 0; i < RECENT_QUERIES_MAX + 3; i++) list = pushQuery(list, `q${i}`);
  assert.equal(list.length, RECENT_QUERIES_MAX);
  assert.equal(list[0], `q${RECENT_QUERIES_MAX + 2}`, 'la piu recente sta in testa');
});

test('le ricerche recenti si rileggono scartando il resto', () => {
  assert.deepEqual(loadQueries(['a', 3, '', ' b ', 'A', null]), ['a', 'b']);
  assert.deepEqual(loadQueries('no'), []);
  assert.equal(
    loadQueries(Array.from({ length: 20 }, (_, i) => `q${i}`)).length,
    RECENT_QUERIES_MAX,
  );
});

// --- riordino della coda -------------------------------------------------

test('la riga trascinata arriva dove sta il dito, senza uscire dalla coda', () => {
  assert.equal(dropIndex(3, 0, 60, 10), 3);
  assert.equal(dropIndex(3, 29, 60, 10), 3, 'sotto mezza riga non si muove');
  assert.equal(dropIndex(3, 31, 60, 10), 4);
  assert.equal(dropIndex(3, -125, 60, 10), 1);
  assert.equal(dropIndex(3, 1000, 60, 10), 9, 'oltre il fondo si ferma all ultima');
  assert.equal(dropIndex(3, -1000, 60, 10), 0);
});

test('le righe fra partenza e arrivo scalano di un posto, le altre no', () => {
  // Trascinando la 1 sulla 3: la 2 e la 3 salgono, 0 e 4 restano.
  assert.equal(rowShift(0, 1, 3, 60), 0);
  assert.equal(rowShift(2, 1, 3, 60), -60);
  assert.equal(rowShift(3, 1, 3, 60), -60);
  assert.equal(rowShift(4, 1, 3, 60), 0);
  assert.equal(rowShift(1, 1, 3, 60), 0, 'la riga in mano segue il dito, non la regola');
  // Trascinando la 3 sulla 1: la 1 e la 2 scendono.
  assert.equal(rowShift(1, 3, 1, 60), 60);
  assert.equal(rowShift(2, 3, 1, 60), 60);
  assert.equal(rowShift(0, 3, 1, 60), 0);
  assert.equal(rowShift(2, 2, 2, 60), 0, 'senza spostamento non si muove niente');
});

// --- prossimo brano ------------------------------------------------------

test('il prossimo brano segue la coda, salvo shuffle e ripetizione', () => {
  const items = [
    { title: 'Uno', artist: 'A' },
    { title: 'Due', artist: 'B' },
    { title: 'Tre', artist: 'C' },
  ];
  const base = { items, activeIndex: 0, shuffle: false, repeat: 'off' as const };
  assert.deepEqual(describeUpNext(base), { kind: 'track', index: 1, title: 'Due', artist: 'B' });
  assert.deepEqual(describeUpNext({ ...base, activeIndex: 2 }), { kind: 'end' });
  assert.deepEqual(describeUpNext({ ...base, activeIndex: 2, repeat: 'all' }), {
    kind: 'track',
    index: 0,
    title: 'Uno',
    artist: 'A',
  });
  assert.deepEqual(describeUpNext({ ...base, repeat: 'one' }), { kind: 'repeat-one' });
  assert.deepEqual(describeUpNext({ ...base, shuffle: true }), { kind: 'shuffle' });
  assert.deepEqual(describeUpNext({ ...base, activeIndex: null }), { kind: 'none' });
  assert.deepEqual(describeUpNext({ ...base, items: [] }), { kind: 'none' });
  assert.deepEqual(
    describeUpNext({ items: [items[0]], activeIndex: 0, shuffle: false, repeat: 'all' }),
    {
      kind: 'repeat-one',
    },
  );
});

test('la riga Prossimo ha un testo per ogni caso e nessuno per niente', () => {
  assert.equal(upNextLabel({ kind: 'track', index: 1, title: 'Due', artist: 'B' }), 'Due · B');
  assert.match(upNextLabel({ kind: 'shuffle' }), /casuale/);
  assert.match(upNextLabel({ kind: 'repeat-one' }), /di nuovo/);
  assert.match(upNextLabel({ kind: 'end' }), /fine/);
  assert.equal(upNextLabel({ kind: 'none' }), '');
});

// --- Android Auto ---------------------------------------------------------

test('l albero per Android Auto mostra solo cio che c e davvero', () => {
  const lib = conTracce(['a', 'b', 'c'], {
    favorites: ['audius:a', 'audius:zz'],
    playlists: [
      { id: 'p1', name: 'Sera', createdAt: 1, trackUids: ['audius:b'] },
      { id: 'p2', name: 'Vuota', createdAt: 2, trackUids: [] },
    ],
    history: ['audius:c', 'audius:a'],
  });
  const tree = buildBrowseTree(lib);
  assert.deepEqual(
    tree.map((c) => c.title),
    ['Preferiti', 'Playlist', 'Ascoltati di recente'],
  );
  assert.deepEqual(
    tree[0]?.items.map((i) => i.mediaId),
    ['audius:a'],
    'un uid non risolvibile sparisce invece di rompere la cartella',
  );
  assert.equal(tree[1]?.items.length, 1, 'la playlist vuota non compare');
  assert.equal(tree[1]?.items[0]?.children?.[0]?.mediaId, 'audius:b');
  assert.equal(tree[0]?.items[0]?.url, 'https://x/a', 'ogni voce porta il suo stream');
  assert.equal(tree[0]?.items[0]?.extras, undefined, 'niente modello intero nel payload');
});

test('senza libreria l albero e vuoto e le cartelle hanno un tetto', () => {
  assert.deepEqual(buildBrowseTree(libreria()), []);
  const ids = Array.from({ length: BROWSE_MAX_ITEMS + 20 }, (_, i) => `t${i}`);
  const lib = conTracce(ids, { favorites: ids.map((i) => `audius:${i}`) });
  assert.equal(buildBrowseTree(lib)[0]?.items.length, BROWSE_MAX_ITEMS);
});

// --- federazione generica ------------------------------------------------

test('la federazione alterna anche cio che non e una traccia', () => {
  const out = combine<{ name: string }>([
    { source: 'audius', result: { status: 'fulfilled', value: [{ name: 'a1' }, { name: 'a2' }] } },
    { source: 'jamendo', result: { status: 'fulfilled', value: [{ name: 'j1' }] } },
  ]);
  assert.deepEqual(
    out.tracks.map((x) => x.name),
    ['a1', 'j1', 'a2'],
  );
  assert.deepEqual(out.failed, []);
});

test('permesso notifiche: si chiede solo su Android 13+, al play e finché il sistema risponde', () => {
  assert.equal(notificationPermissionRequired('android', 33), true);
  assert.equal(notificationPermissionRequired('android', '36'), true);
  assert.equal(notificationPermissionRequired('android', 32), false);
  assert.equal(notificationPermissionRequired('ios', 40), false);

  assert.equal(statusFromRequest('granted'), 'granted');
  assert.equal(statusFromRequest('denied'), 'denied');
  assert.equal(statusFromRequest('never_ask_again'), 'blocked');

  // check() dice solo sì o no: un blocco già noto non torna «negato».
  assert.equal(statusFromCheck(true, 'blocked'), 'granted');
  assert.equal(statusFromCheck(false, 'blocked'), 'blocked');
  assert.equal(statusFromCheck(false, 'unknown'), 'denied');
  assert.equal(statusFromCheck(false, 'granted'), 'denied');

  assert.equal(shouldRequest('unknown'), true);
  assert.equal(shouldRequest('denied'), true);
  assert.equal(shouldRequest('blocked'), false);
  assert.equal(shouldRequest('granted'), false);
  assert.equal(shouldRequest('unnecessary'), false);

  assert.deepEqual(notificationRemedy('denied'), { kind: 'request', label: 'Consenti' });
  assert.deepEqual(notificationRemedy('blocked'), { kind: 'settings', label: 'Impostazioni' });
  assert.equal(notificationRemedy('granted'), null);
  assert.equal(notificationRemedy('unknown'), null);
  assert.equal(notificationRemedy('unnecessary'), null);
});

test('route: raccolte e id accettati solo se previsti, il resto si rifiuta', () => {
  assert.equal(parseCollectionKind('favorites'), 'favorites');
  assert.equal(parseCollectionKind('history'), 'history');
  assert.equal(parseCollectionKind('bogus'), null);
  assert.equal(parseCollectionKind(undefined), null);
  assert.equal(parseCollectionKind(['favorites']), null);

  assert.equal(parseEntityId('abc'), 'abc');
  assert.equal(parseEntityId(''), null);
  assert.equal(parseEntityId('   '), null);
  assert.equal(parseEntityId(undefined), null);
  assert.equal(parseEntityId(['a', 'b']), null);
});

test('cronologia: un brano conta dopo trenta secondi, o a metà se è più corto di un minuto', () => {
  assert.equal(listenThreshold(240), LISTEN_THRESHOLD_SEC);
  assert.equal(listenThreshold(60), 30);
  assert.equal(listenThreshold(20), 10);
  // Durata ignota (stream non ancora preparato): vale la soglia piena.
  assert.equal(listenThreshold(0), LISTEN_THRESHOLD_SEC);
  assert.equal(listenThreshold(Number.NaN), LISTEN_THRESHOLD_SEC);

  assert.equal(reachedListen(29.9, 240), false);
  assert.equal(reachedListen(30, 240), true);
  assert.equal(reachedListen(10, 20), true);
  assert.equal(reachedListen(9, 20), false);
  assert.equal(reachedListen(Number.NaN, 240), false);
});

function memoryKV(
  initial: Record<string, string> = {},
): KeyValue & { dump(): Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key),
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}

test('storage: un telefono vuoto parte alla versione corrente, i dati senza versione valgono 1', () => {
  const fresh = memoryKV();
  assert.equal(readStorageVersion(fresh), STORAGE_VERSION);
  assert.deepEqual(migrateStorage(fresh).outcome, 'current');
  assert.equal(fresh.get(VERSION_KEY), String(STORAGE_VERSION));

  const legacy = memoryKV({ 'library.v1': '{"favorites":[]}' });
  assert.equal(readStorageVersion(legacy), 1);
  assert.equal(readStorageVersion(memoryKV({ [VERSION_KEY]: '7' })), 7);
  assert.equal(readStorageVersion(memoryKV({ [VERSION_KEY]: 'boh', 'playback.v1': '{}' })), 1);
});

test('storage: da 1 a 2 il repeat numerico diventa stringa, con backup e senza ripetersi', () => {
  const kv = memoryKV({
    'playback.v1': '{"shuffle":true,"repeat":2}',
    'library.v1': '{"favorites":["audius:1"]}',
  });
  const first = migrateStorage(kv);
  assert.equal(first.outcome, 'upgraded');
  assert.equal(first.from, 1);
  assert.equal(first.to, STORAGE_VERSION);
  assert.equal(first.applied.length, 1);
  assert.deepEqual(JSON.parse(kv.get('playback.v1')!), { shuffle: true, repeat: 'all' });
  assert.equal(kv.get('library.v1'), '{"favorites":["audius:1"]}');
  // Il backup e' la fotografia di prima, con la sua versione.
  assert.equal(kv.get(BACKUP_PREFIX + 'playback.v1'), '{"shuffle":true,"repeat":2}');
  assert.equal(kv.get(BACKUP_PREFIX + 'version'), '1');
  assert.equal(kv.get(VERSION_KEY), String(STORAGE_VERSION));

  const after = kv.dump();
  assert.equal(migrateStorage(kv).outcome, 'current');
  assert.deepEqual(kv.dump(), after);

  // Repeat gia' stringa o assente: la migrazione non inventa niente.
  const clean = memoryKV({ 'playback.v1': '{"repeat":"one"}' });
  migrateStorage(clean);
  assert.deepEqual(JSON.parse(clean.get('playback.v1')!), { repeat: 'one' });
  const truncated = memoryKV({ 'playback.v1': '{"repeat":' });
  assert.equal(migrateStorage(truncated).outcome, 'upgraded');
  assert.equal(truncated.get('playback.v1'), '{"repeat":');
});

test('storage: una versione più nuova non si tocca e un dato illeggibile va in quarantena', () => {
  const newer = memoryKV({ [VERSION_KEY]: String(STORAGE_VERSION + 1), 'playback.v1': '{"x":1}' });
  const before = newer.dump();
  assert.equal(migrateStorage(newer).outcome, 'newer');
  assert.deepEqual(newer.dump(), before);

  const kv = memoryKV({ 'library.v1': '{"favorites":[' });
  quarantine(kv, 'library.v1', '{"favorites":[');
  assert.equal(kv.get('library.v1'), undefined);
  assert.equal(kv.get(QUARANTINE_PREFIX + 'library.v1'), '{"favorites":[');
});

test("player: la copertina si adatta all'altezza e sotto il minimo il pannello scorre", () => {
  const base = { fontScale: 1, insetTop: 40, insetBottom: 24, horizontalPadding: 24 };
  // Motorola Edge 50 Neo (427x949 dp): comanda l'altezza, di poco.
  assert.deepEqual(artworkLayout({ ...base, width: 427, height: 949 }), {
    size: 355,
    cramped: false,
  });
  // Tablet: comanda la larghezza del pannello.
  assert.equal(artworkLayout({ ...base, width: 427, height: 1400 }).size, 379);
  // Schermo basso: comanda l'altezza, senza scorrere finche' resta il minimo.
  const low = artworkLayout({ ...base, width: 360, height: 760 });
  assert.equal(low.size, 166);
  assert.equal(low.cramped, false);
  // 360x640: non entra nemmeno la copertina minima, si scorre.
  const tiny = artworkLayout({ ...base, width: 360, height: 640 });
  assert.equal(tiny.size, ARTWORK_MIN);
  assert.equal(tiny.cramped, true);
  // Scala dei caratteri 1.3: la copertina cede spazio al testo, non ai controlli.
  const big = artworkLayout({ ...base, width: 427, height: 949, fontScale: 1.3 });
  assert.equal(big.size < 355 && big.size > ARTWORK_MIN, true);
  assert.equal(big.cramped, false);
  // A 2.0 anche questo telefono scorre.
  assert.equal(artworkLayout({ ...base, width: 427, height: 949, fontScale: 2 }).cramped, true);
});

test('rete: tre tentativi automatici a distanze crescenti, poi resta il Riprova', () => {
  assert.deepEqual([0, 1, 2].map(networkRetryDelay), [...NETWORK_RETRY_DELAYS_MS]);
  assert.equal(networkRetryDelay(3), null);
  assert.equal(
    NETWORK_RETRY_DELAYS_MS.every((d, i) => i === 0 || d > NETWORK_RETRY_DELAYS_MS[i - 1]),
    true,
  );
});

test('federazione: ogni sorgente viene interrogata una volta sola', async () => {
  const original = { ...SOURCES };
  let audiusCalls = 0;
  let jamendoCalls = 0;
  const fake = (id: SourceId, count: () => void, withSpotlight: boolean): MusicSource =>
    ({
      id,
      label: id,
      search: async () => {
        count();
        return [];
      },
      trending: async () => [],
      artistTracks: async () => [],
      artistInfo: async () => ({ id, name: id, source: id }) as never,
      ...(withSpotlight
        ? {
            spotlight: async () => {
              count();
              return [];
            },
          }
        : {}),
    }) as MusicSource;

  SOURCES.audius = { source: fake('audius', () => audiusCalls++, true), enabled: true };
  SOURCES.jamendo = { source: fake('jamendo', () => jamendoCalls++, false), enabled: true };
  try {
    await searchAll('onda');
    // Una richiesta di rete per sorgente. Prima erano due: la stessa
    // funzione veniva chiamata anche solo per sapere se ritornava null,
    // e quella scartata restava una promise senza gestore.
    assert.equal(audiusCalls, 1);
    assert.equal(jamendoCalls, 1);

    audiusCalls = 0;
    jamendoCalls = 0;
    // Jamendo non offre le vetrine: viene saltata, non interrogata.
    await spotlightAll('rising');
    assert.equal(audiusCalls, 1);
    assert.equal(jamendoCalls, 0);
  } finally {
    Object.assign(SOURCES, original);
  }
});

// --- identita' della build --------------------------------------------

test('la build personale porta il commit nel nome di versione, la release no', () => {
  const pulito = { commit: 'abcdef1234567890', dirty: false };
  assert.equal(versionName('0.2.0', 'personal', pulito), '0.2.0+abcdef1');
  // La release ha il suo numero: il commit la' dentro non aiuterebbe nessuno.
  assert.equal(versionName('0.2.0', 'release', pulito), '0.2.0');
  // Worktree sporco: lo dice, altrimenti due APK diversi si chiamerebbero uguale.
  assert.equal(versionName('0.2.0', 'personal', { ...pulito, dirty: true }), '0.2.0+abcdef1.dirty');
  // Sorgente senza Git: meglio dichiarare di non sapere che tacere.
  assert.equal(
    versionName('0.2.0', 'personal', { commit: null, dirty: false }),
    '0.2.0+sconosciuto',
  );
  assert.equal(shortCommit('abcdef1234567890')?.length, SHORT_COMMIT_LENGTH);
  assert.equal(shortCommit(null), null);
});

test('il confronto con il telefono distingue assente, allineato e diverso', () => {
  assert.equal(compareInstalled(null, '0.2.0+abcdef1').state, 'assente');
  assert.equal(compareInstalled('0.2.0+abcdef1', '0.2.0+abcdef1').state, 'allineato');
  assert.equal(compareInstalled('0.2.0+abcdef1', '0.2.0+9999999').state, 'diverso');
  // Lo stesso commit con worktree sporco non e' lo stesso APK.
  assert.equal(compareInstalled('0.2.0+abcdef1', '0.2.0+abcdef1.dirty').state, 'diverso');
});

// --- richieste di catalogo --------------------------------------------

/** Sostituisce `fetch` per la durata di una prova e lo rimette com'era. */
async function withFetch(fake: typeof globalThis.fetch, body: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
}

/** Una rete che accetta la connessione e poi tace, fino all'abort. */
const hanging: typeof globalThis.fetch = (_url, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted.')));
  });

const responding =
  (status: number, payload: unknown): typeof globalThis.fetch =>
  async () =>
    ({ ok: status >= 200 && status < 300, status, json: async () => payload }) as Response;

test('catalogo: una richiesta che resta appesa si arrende invece di aspettare per sempre', async () => {
  await withFetch(hanging, async () => {
    await assert.rejects(
      () => fetchJSON('Jamendo', 'https://esempio.invalid/tracks', 20),
      (error: Error) => {
        assert.equal(error.message, timeoutMessage('Jamendo', 20));
        // Il messaggio deve arrivare a schermo come un guasto di rete, non
        // come il testo tecnico di un'eccezione: e' la stessa esperienza di
        // un DNS che non risolve, e la federazione lo sa gia' tradurre.
        assert.equal(describeFailure(error), 'rete non raggiungibile');
        return true;
      },
    );
  });
});

test('catalogo: il tetto di tempo lascia passare una risposta che arriva', async () => {
  // Con il timer non disarmato questo test finirebbe comunque, ma il
  // processo resterebbe vivo fino alla scadenza: qui il tetto e' quello
  // vero, quindi `node --test` uscirebbe quindici secondi piu' tardi.
  await withFetch(responding(200, { results: [1, 2] }), async () => {
    const json = await fetchJSON<{ results: number[] }>('Jamendo', 'https://esempio.invalid/');
    assert.deepEqual(json.results, [1, 2]);
  });
});

test('catalogo: uno stato HTTP di errore dice quale sorgente ha risposto cosa', async () => {
  await withFetch(responding(503, {}), async () => {
    await assert.rejects(() => fetchJSON('Audius', 'https://esempio.invalid/'), {
      message: 'Audius ha risposto 503',
    });
  });
  // Non e' un guasto di rete: il messaggio resta intero, perche' un 503
  // ripetuto e' esattamente cio' che si vuole poter leggere.
  assert.equal(describeFailure(new Error('Audius ha risposto 503')), 'Audius ha risposto 503');
  assert.equal(REQUEST_TIMEOUT_MS > 0, true);
});
