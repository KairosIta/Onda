/// <reference types="node" />

/**
 * Il Client ID Jamendo viaggia nell'URL di stream (`from=app-<client_id>`)
 * e non deve finire in niente che si salvi o si esporti: qui si prova
 * tutta la strada, dall'adapter al player e ritorno, fino alla migrazione
 * dei dati scritti prima della regola.
 */

import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { buildBrowseTree } from '@/services/browseTree';
import { playbackUrl, toMediaItem, trackFromMediaItem } from '@/services/mediaItems';
import { NO_ACCESS, type SourceAccess, setSourceAccess } from '@/services/sources/access';
import { audiusSource } from '@/services/sources/audius';
import { jamendoSource } from '@/services/sources/jamendo';
import {
  isJamendoUrl,
  stripJamendoAppTag,
  tagJamendoStream,
} from '@/services/sources/jamendoStream';
import { describeAttribution, isWebUrl } from '@/services/sources/meta';
import {
  BACKUP_PREFIX,
  type KeyValue,
  STORAGE_VERSION,
  VERSION_KEY,
  migrateStorage,
  withoutStreamCredentials,
} from '@/services/storageSchema';
import { buildExport } from '@/store/libraryExport';
import { loadLibrary, parseTrack } from '@/store/librarySchema';
import { loadSavedQueue } from '@/store/sessionSchema';
import type { Track } from '@/types/track';

// Valori finti: nessuna credenziale vera passa di qui.
const CLIENT_ID = 'id-di-prova';
const ACCESS: SourceAccess = {
  credentials: () => ({ jamendoClientId: CLIENT_ID, audiusApiKey: '' }),
  isActive: () => true,
};
setSourceAccess(ACCESS);
afterEach(() => setSourceAccess(ACCESS));

const STREAM = 'https://prod-1.storage.jamendo.com/?trackid=1532771&format=mp32';
const TAGGED = `${STREAM}&from=app-${CLIENT_ID}`;

const jamendoTrack = (streamUrl = STREAM): Track => ({
  uid: 'jamendo:1532771',
  source: 'jamendo',
  id: '1532771',
  title: 'Brano',
  artist: 'Artista',
  durationSec: 200,
  streamUrl,
});

const audiusTrack: Track = {
  uid: 'audius:a1',
  source: 'audius',
  id: 'a1',
  title: 'Altro',
  artist: 'Qualcuno',
  durationSec: 100,
  streamUrl: 'https://api.audius.co/v1/tracks/a1/stream?app_name=Onda',
};

async function withFetch(fake: typeof globalThis.fetch, body: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
}

const responding =
  (payload: unknown, urls: string[] = []): typeof globalThis.fetch =>
  async (url) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => payload } as Response;
  };

function memoryKV(initial: Record<string, string> = {}): KeyValue {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key),
    set: (key, value) => void map.set(key, value),
    delete: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

test('jamendo: il parametro from si toglie e si rimette solo sugli URL Jamendo', () => {
  assert.equal(stripJamendoAppTag(TAGGED), STREAM);
  assert.equal(stripJamendoAppTag(`${STREAM}&from=app-x&other=1`), `${STREAM}&other=1`);
  assert.equal(
    stripJamendoAppTag('https://mp3l.jamendo.com/?from=app-77b5b682'),
    'https://mp3l.jamendo.com/',
  );
  assert.equal(stripJamendoAppTag(STREAM), STREAM, 'senza from resta identico');
  // Un altro host non si tocca, nemmeno con lo stesso parametro.
  assert.equal(
    stripJamendoAppTag(`${audiusTrack.streamUrl}&from=app-x`),
    `${audiusTrack.streamUrl}&from=app-x`,
  );
  assert.equal(isJamendoUrl('https://evil.test/jamendo.com/?from=app-x'), false);
  assert.equal(isJamendoUrl('https://notjamendo.com/?x'), false);

  assert.equal(tagJamendoStream(STREAM, CLIENT_ID), TAGGED);
  assert.equal(tagJamendoStream(TAGGED.replace(CLIENT_ID, 'vecchio'), CLIENT_ID), TAGGED);
  assert.equal(
    tagJamendoStream('https://mp3l.jamendo.com/', 'a b'),
    'https://mp3l.jamendo.com/?from=app-a%20b',
  );
  assert.equal(tagJamendoStream(STREAM, ''), STREAM, 'senza Client ID niente parametro');
  assert.equal(tagJamendoStream(audiusTrack.streamUrl, CLIENT_ID), audiusTrack.streamUrl);
});

test("jamendo: l'adapter salva lo stream senza Client ID e il player lo riceve con quello corrente", async () => {
  const payload = {
    headers: { status: 'success' },
    results: [
      { id: '1532771', name: 'Brano', artist_name: 'Artista', duration: 200, audio: TAGGED },
      // Voci che la API non dovrebbe mandare, ma una pagina non deve cadere per loro.
      { id: '2', name: 7, artist_name: null, duration: '3', audio: TAGGED, image: 5 },
      { id: 3, name: 'Senza id valido', audio: TAGGED },
      { id: '4', name: 'Senza stream' },
      null,
    ],
  };
  await withFetch(responding(payload), async () => {
    const tracks = await jamendoSource.search({ query: 'x' });
    assert.deepEqual(
      tracks.map((t) => [t.id, t.title, t.artist, t.streamUrl]),
      [
        ['1532771', 'Brano', 'Artista', STREAM],
        ['2', 'Senza titolo', 'Sconosciuto', STREAM],
      ],
    );
    for (const t of tracks) {
      assert.equal(JSON.stringify(t).includes(CLIENT_ID), false, 'il brano non porta il Client ID');
      assert.equal(toMediaItem(t).url, TAGGED);
    }
  });

  setSourceAccess({
    ...ACCESS,
    credentials: () => ({ jamendoClientId: 'nuovo', audiusApiKey: '' }),
  });
  assert.equal(
    playbackUrl(jamendoTrack()),
    `${STREAM}&from=app-nuovo`,
    'cambiato in Sorgenti, vale subito',
  );
  assert.equal(playbackUrl(audiusTrack), audiusTrack.streamUrl);
  setSourceAccess(NO_ACCESS);
  assert.equal(playbackUrl(jamendoTrack()), STREAM, 'senza credenziali l’URL resta pulito');
});

test('jamendo: dal player e dai dati salvati il Client ID non rientra', () => {
  const rebuilt = trackFromMediaItem({
    mediaId: 'jamendo:1532771',
    url: TAGGED,
    title: 'B',
    artist: 'A',
  });
  assert.equal(rebuilt?.streamUrl, STREAM);

  // Dati scritti prima della regola, riletti oggi.
  assert.equal(parseTrack(jamendoTrack(TAGGED))?.streamUrl, STREAM);
  const library = loadLibrary({
    tracks: { 'jamendo:1532771': jamendoTrack(TAGGED) },
    favorites: ['jamendo:1532771'],
    playlists: [],
    history: [],
  });
  assert.equal(
    JSON.stringify(buildExport(library)).includes(CLIENT_ID),
    false,
    "l'export non lo contiene",
  );
  const queue = loadSavedQueue(
    { tracks: [jamendoTrack(TAGGED)], index: 0, savedAt: Date.now() },
    Date.now(),
  );
  assert.equal(queue?.tracks[0]?.streamUrl, STREAM);
});

test("android auto: l'albero porta l'URL di riproduzione, quello salvato no", () => {
  const library = loadLibrary({
    tracks: { 'jamendo:1532771': jamendoTrack(), 'audius:a1': audiusTrack },
    favorites: ['jamendo:1532771', 'audius:a1'],
    playlists: [],
    history: [],
  });
  const urls = (tree: ReturnType<typeof buildBrowseTree>) => tree[0]?.items.map((item) => item.url);
  assert.deepEqual(urls(buildBrowseTree(library, () => true, playbackUrl)), [
    TAGGED,
    audiusTrack.streamUrl,
  ]);
  assert.deepEqual(urls(buildBrowseTree(library, () => true)), [STREAM, audiusTrack.streamUrl]);
});

test('storage: da 4 a 5 il Client ID esce dagli URL salvati, anche dal backup e dalla cache', () => {
  const library = JSON.stringify({
    tracks: { 'jamendo:1532771': jamendoTrack(TAGGED), 'audius:a1': audiusTrack },
    favorites: ['jamendo:1532771'],
    playlists: [],
    history: [],
  });
  const queue = JSON.stringify({ tracks: [jamendoTrack(TAGGED)], index: 0, savedAt: 1 });
  const cache = JSON.stringify({
    queries: [
      {
        queryKey: ['album-tracks', 'jamendo', '9'],
        queryHash: 'h',
        state: {
          status: 'success',
          dataUpdatedAt: 1,
          data: { pages: [{ tracks: [jamendoTrack(TAGGED)], failed: [] }], pageParams: [null] },
        },
      },
    ],
    mutations: [],
  });
  const kv = memoryKV({
    [VERSION_KEY]: '4',
    'library.v1': library,
    'session.queue.v1': queue,
    'query-cache.v1': cache,
    'search.recent.v1': '["jamendo from=app-id-di-prova"]',
  });
  const report = migrateStorage(kv);
  assert.equal(report.outcome, 'upgraded');
  assert.deepEqual(report.applied.length, 1);
  assert.equal(kv.get(VERSION_KEY), String(STORAGE_VERSION));
  for (const key of ['library.v1', 'session.queue.v1', 'query-cache.v1']) {
    for (const target of [key, BACKUP_PREFIX + key]) {
      const raw = kv.get(target);
      if (key === 'query-cache.v1' && target !== key) {
        assert.equal(raw, undefined, 'la cache non ha backup');
        continue;
      }
      assert.ok(raw, target);
      assert.equal(raw.includes(CLIENT_ID), false, `${target} senza Client ID`);
      assert.ok(raw.includes(STREAM), `${target} conserva lo stream`);
    }
  }
  // Solo gli URL di stream: il resto dei dati non si tocca.
  assert.equal(kv.get('search.recent.v1'), '["jamendo from=app-id-di-prova"]');
  assert.equal(
    JSON.parse(kv.get('library.v1')!).tracks['audius:a1'].streamUrl,
    audiusTrack.streamUrl,
  );

  // Niente da ripulire: niente riscritture.
  const clean = { a: [{ streamUrl: STREAM, n: 1 }], b: 'x' };
  assert.strictEqual(withoutStreamCredentials(clean), clean);
  assert.equal(
    migrateStorage(memoryKV({ [VERSION_KEY]: '4', 'library.v1': '{"tracks":{}}' })).outcome,
    'upgraded',
  );
});

test('attribuzione: si aprono solo collegamenti web, anche in http per le licenze CC', () => {
  assert.equal(isWebUrl('http://creativecommons.org/licenses/by-sa/3.0/'), true);
  assert.equal(isWebUrl('https://www.jamendo.com/track/1'), true);
  assert.equal(isWebUrl('intent://x#Intent;end'), false);
  assert.equal(isWebUrl('javascript:alert(1)'), false);
  assert.equal(isWebUrl('file:///etc/hosts'), false);

  const parts = describeAttribution({
    ...jamendoTrack(),
    sourceUrl: 'intent://x#Intent;scheme=onda;end',
    rightsLabel: 'CC BY-SA 3.0',
    licenseUrl: 'http://creativecommons.org/licenses/by-sa/3.0/',
  }).parts;
  assert.equal(
    parts.some((p) => p.kind === 'link' && p.label === 'Pagina del brano'),
    false,
  );
  assert.deepEqual(parts[0], {
    kind: 'link',
    label: 'CC BY-SA 3.0',
    url: 'http://creativecommons.org/licenses/by-sa/3.0/',
  });
});

test('audius: gli id nel percorso si codificano e una voce malformata non fa cadere la pagina', async () => {
  const urls: string[] = [];
  await withFetch(responding({ data: { id: 'u1', name: 'X' } }, urls), async () => {
    await audiusSource.artistInfo('a/b?c');
  });
  assert.match(urls[0] ?? '', /\/users\/a%2Fb%3Fc\?app_name=/u);

  const payload = {
    data: [
      { id: 't1', title: 'Ok', duration: 10, user: { name: 'N', handle: 'h' } },
      { id: 't2', duration: 10, user: { name: 'N', handle: 'h' } },
      { title: 'Senza id', duration: 10, user: { name: 'N', handle: 'h' } },
      {
        id: 't3',
        title: 'Gated',
        is_stream_gated: true,
        duration: 10,
        user: { name: 'N', handle: 'h' },
      },
      null,
    ],
  };
  await withFetch(responding(payload), async () => {
    const tracks = await audiusSource.trending();
    assert.deepEqual(
      tracks.map((t) => t.id),
      ['t1'],
    );
  });
  await withFetch(responding({ data: 'non un elenco' }), async () => {
    assert.deepEqual(await audiusSource.trending(), []);
  });
});
