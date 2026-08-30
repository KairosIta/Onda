/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTracksOffset } from '@/hooks/infiniteTracksCursor';
import { audiusRightsLabel, audiusTrackUrl } from '@/services/sources/audius';
import {
  MAX_SOURCE_SKIPS,
  budgetAfterPlayingChange,
  decideSkip,
  type SkipContext,
} from '@/services/playbackPolicy';
import { combine, describeFailure, interleave } from '@/services/sources/federation';
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
import { formatTime } from '@/theme';
import type { Track } from '@/types/track';
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
