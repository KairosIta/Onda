/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCES, artistTracksPage, searchAll, trendingAll } from '@/services/sources';
import { NO_ACCESS, setSourceAccess } from '@/services/sources/access';
import { audiusSource } from '@/services/sources/audius';

const audiusTrack = (id: string) => ({
  id,
  title: `Brano di prova ${id}`,
  duration: 60,
  user: { id: 'artista', name: 'Artista di prova', handle: 'prova' },
});

async function withAudius(
  respond: (offset: number, url: URL) => unknown[],
  check: (offsets: number[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const offsets: number[] = [];
  setSourceAccess({ ...NO_ACCESS, isActive: (id) => id === 'audius' });
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.audius.co');
    const offset = Number(url.searchParams.get('offset') ?? 0);
    offsets.push(offset);
    assert.ok(offsets.length <= 10, 'la paginazione deve terminare');
    return new Response(JSON.stringify({ data: respond(offset, url) }));
  };
  try {
    await check(offsets);
  } finally {
    globalThis.fetch = originalFetch;
    setSourceAccess(NO_ACCESS);
  }
}

test('audius: supera piu pagine filtrate anche dopo aver gia caricato dei brani', async () => {
  await withAudius(
    (offset) => {
      if (offset === 0) return [audiusTrack('primo')];
      if (offset === 20) return [{ ...audiusTrack('gated'), is_stream_gated: true }];
      if (offset === 40) return [null, { title: 'Senza id' }];
      if (offset === 60) return [audiusTrack('ultimo')];
      return [];
    },
    async (offsets) => {
      const first = await searchAll('prova');
      assert.deepEqual(
        first.tracks.map((t) => t.id),
        ['primo'],
      );
      const second = await searchAll('prova', { cursor: first.next });
      assert.deepEqual(
        second.tracks.map((t) => t.id),
        ['ultimo'],
      );
      assert.deepEqual(second.next, { audius: 80 });
      const end = await searchAll('prova', { cursor: second.next });
      assert.equal(end.next, undefined);
      assert.deepEqual(offsets, [0, 20, 40, 60, 80]);
    },
  );
});

test('audius: un catalogo tutto filtrato termina sulla risposta davvero vuota', async () => {
  await withAudius(
    (offset) =>
      offset < 40 ? [{ ...audiusTrack(`escluso-${offset}`), is_streamable: false }] : [],
    async (offsets) => {
      assert.deepEqual(await searchAll('prova'), { tracks: [], failed: [], next: undefined });
      assert.deepEqual(offsets, [0, 20, 40]);
    },
  );
});

test('audius: un errore dopo la pagina filtrata si ritenta senza perdere i brani', async () => {
  let fail = true;
  await withAudius(
    (offset) => {
      if (offset === 0) return [audiusTrack('primo')];
      if (offset === 20) return [{ ...audiusTrack('gated'), is_stream_gated: true }];
      if (offset === 40) {
        if (fail) {
          fail = false;
          throw new Error('Audius ha risposto 503');
        }
        return [audiusTrack('recuperato')];
      }
      return [];
    },
    async (offsets) => {
      const first = await searchAll('prova');
      await assert.rejects(searchAll('prova', { cursor: first.next }), /Audius ha risposto 503/);
      assert.deepEqual(first.next, { audius: 20 }, 'il cursore ricevuto resta riutilizzabile');
      const retry = await searchAll('prova', { cursor: first.next });
      assert.deepEqual(
        retry.tracks.map((t) => t.id),
        ['recuperato'],
      );
      assert.deepEqual(retry.next, { audius: 60 });
      assert.deepEqual(offsets, [0, 20, 40, 20, 40]);
    },
  );
});

test('audius: annullare durante la pagina filtrata impedisce la richiesta successiva', async () => {
  const controller = new AbortController();
  await withAudius(
    () => {
      controller.abort();
      return [{ ...audiusTrack('gated'), is_stream_gated: true }];
    },
    async (offsets) => {
      await assert.rejects(
        searchAll('prova', { signal: controller.signal }),
        /richiesta annullata/,
      );
      assert.deepEqual(offsets, [0]);
    },
  );
});

test('audius: supera la pagina filtrata anche se Jamendo e giu', async () => {
  const original = SOURCES.jamendo;
  let jamendoCalls = 0;
  SOURCES.jamendo = {
    ...original,
    search: async () => {
      jamendoCalls++;
      throw new Error('Jamendo ha risposto 503');
    },
  };
  try {
    await withAudius(
      (offset) =>
        offset === 0
          ? [{ ...audiusTrack('gated'), is_stream_gated: true }]
          : [audiusTrack('valido')],
      async (offsets) => {
        setSourceAccess({ ...NO_ACCESS, isActive: () => true });
        const page = await searchAll('prova');
        assert.deepEqual(
          page.tracks.map((t) => t.id),
          ['valido'],
        );
        assert.deepEqual(page.next, { audius: 40, jamendo: 0 });
        assert.deepEqual(page.failed, [{ source: 'jamendo', message: 'Jamendo ha risposto 503' }]);
        assert.equal(jamendoCalls, 1, 'non ritentare subito la sorgente caduta');
        assert.deepEqual(offsets, [0, 20]);
      },
    );
  } finally {
    SOURCES.jamendo = original;
  }
});

test('paginazione: un limite non positivo o non intero non avvia richieste', async () => {
  await withAudius(
    () => [],
    async (offsets) => {
      for (const limit of [0, -1, 0.5, Infinity, NaN]) {
        await assert.rejects(searchAll('prova', { limit }), /Limite di pagina non valido/);
      }
      assert.deepEqual(offsets, []);
    },
  );
});

const routes = [
  {
    name: 'ricerca',
    path: '/v1/tracks/search',
    params: { query: 'brani di prova' },
    fetch: (cursor?: unknown) => searchAll('brani di prova', { limit: 20, cursor }),
  },
  {
    name: 'trending per genere',
    path: '/v1/tracks/trending',
    params: { genre: 'Hip-Hop/Rap' },
    fetch: (cursor?: unknown) => trendingAll({ genreKey: 'hiphop', limit: 20, cursor }),
  },
  {
    name: 'brani artista',
    path: '/v1/users/artista/tracks',
    params: {},
    fetch: (cursor?: unknown) => artistTracksPage(audiusSource, 'artista', { limit: 20, cursor }),
  },
];

for (const route of routes) {
  test(`audius: ${route.name} carica la pagina valida dopo una pagina non riproducibile`, async () => {
    await withAudius(
      (offset, url) => {
        assert.equal(url.pathname, route.path);
        assert.equal(url.searchParams.get('limit'), '20');
        assert.equal(url.searchParams.get('app_name'), 'Onda');
        for (const [key, value] of Object.entries(route.params)) {
          assert.equal(url.searchParams.get(key), value);
        }
        if (offset === 0) {
          return Array.from({ length: 20 }, (_, i) => ({
            ...audiusTrack(`escluso-${i}`),
            ...(i % 2 === 0 ? { is_stream_gated: true } : { is_streamable: false }),
          }));
        }
        if (offset === 20) return [audiusTrack('valido-20'), audiusTrack('valido-21')];
        if (offset === 40) return [audiusTrack('valido-40')];
        return [];
      },
      async (offsets) => {
        // Anche una lista inizialmente vuota deve raggiungere i brani:
        // non dipende da un nuovo onEndReached della FlatList.
        const first = await route.fetch();
        assert.deepEqual(
          first.tracks.map((t) => t.id),
          ['valido-20', 'valido-21'],
        );
        assert.deepEqual(first.next, { audius: 40 });
        assert.deepEqual(first.failed, []);

        const second = await route.fetch(first.next);
        assert.deepEqual(
          second.tracks.map((t) => t.id),
          ['valido-40'],
        );
        assert.deepEqual(second.next, { audius: 60 });

        const end = await route.fetch(second.next);
        assert.deepEqual(end.tracks, []);
        assert.equal(end.next, undefined);
        assert.deepEqual(offsets, [0, 20, 40, 60]);
      },
    );
  });
}
