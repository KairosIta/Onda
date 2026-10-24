/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { createQueryClient } from '@/services/queryClient';
import { QUERY_CACHE_MAX_AGE_MS } from '@/services/queryPersistenceSchema';
import { readJSON, writeJSON } from '@/services/storage';
import { setAppState } from './doubles/react-native';

/**
 * Il cablaggio della cache di React Query su MMKV: lo schema della potatura
 * e' testato a parte, qui si prova che il client vero scriva soltanto le
 * chiavi persistibili, senza i brani Audius, e che all'avvio rilegga solo
 * cio' che e' ancora fresco. Una regressione qui farebbe finire su disco i
 * dati di sessione o le ricerche.
 */

const KEY = 'query-cache.v1';

const page = (ids: { source: string; id: string }[]) => ({
  pages: [
    {
      tracks: ids.map(({ source, id }) => ({ uid: `${source}:${id}`, source, id })),
      failed: [],
    },
  ],
  pageParams: [undefined],
});

/** Le query salvate, per chiave. */
function saved(): Map<string, { data: unknown; isInvalidated?: boolean }> {
  const file = readJSON(KEY) as { queries?: { queryKey: unknown[]; state: unknown }[] };
  return new Map(
    (file.queries ?? []).map((q) => [
      JSON.stringify(q.queryKey),
      q.state as { data: unknown; isInvalidated?: boolean },
    ]),
  );
}

test('su disco vanno solo le chiavi persistibili, senza i brani Audius e segnate da rinfrescare', () => {
  const client = createQueryClient();
  client.setQueryData(['search', 'love'], page([{ source: 'jamendo', id: 's1' }]));
  assert.equal(readJSON(KEY), undefined, 'una ricerca da sola non apre nemmeno la scrittura');

  client.setQueryData(
    ['trending', 'all'],
    page([
      { source: 'audius', id: 'a1' },
      { source: 'jamendo', id: 'j1' },
    ]),
  );
  client.setQueryData(['artist', 'audius', 'u1'], { name: 'Solo in sessione' });
  client.setQueryData(['album', 'jamendo', 'al1'], { name: 'Su disco' });

  // In uscita dall'app la scrittura non aspetta il ritardo.
  setAppState('background');
  setAppState('active');

  const onDisk = saved();
  assert.deepEqual(
    [...onDisk.keys()].sort(),
    ['["album","jamendo","al1"]', '["trending","all"]'],
    'niente ricerca, niente profilo Audius',
  );
  const trending = onDisk.get('["trending","all"]');
  assert.deepEqual(
    (trending?.data as { pages: { tracks: { uid: string }[] }[] }).pages[0].tracks.map(
      (t) => t.uid,
    ),
    ['jamendo:j1'],
    'i brani Audius restano in memoria',
  );
  assert.equal(trending?.isInvalidated, true, 'l elenco tornera completo dalla rete');
  // I timer di garbage collection di React Query durano tre giorni e
  // terrebbero vivo il processo di test: le query si tolgono alla fine.
  const inMemory = client.getQueryData(['trending', 'all']);
  client.clear();
  assert.deepEqual(
    inMemory,
    page([
      { source: 'audius', id: 'a1' },
      { source: 'jamendo', id: 'j1' },
    ]),
    'in memoria la pagina resta intera',
  );
});

test('all avvio si rilegge solo cio che e ancora fresco', () => {
  const file = readJSON(KEY) as {
    queries: { queryKey: unknown[]; state: { dataUpdatedAt: number } }[];
  };
  const stale = file.queries.map((q) =>
    JSON.stringify(q.queryKey) === '["album","jamendo","al1"]'
      ? { ...q, state: { ...q.state, dataUpdatedAt: Date.now() - QUERY_CACHE_MAX_AGE_MS - 60_000 } }
      : q,
  );
  writeJSON(KEY, { ...file, queries: stale });

  const fresh = createQueryClient();
  assert.deepEqual(
    (
      fresh.getQueryData(['trending', 'all']) as { pages: { tracks: { uid: string }[] }[] }
    ).pages[0].tracks.map((t) => t.uid),
    ['jamendo:j1'],
    'il trending di poco fa torna da disco',
  );
  assert.equal(fresh.getQueryData(['album', 'jamendo', 'al1']), undefined, 'l album scaduto no');
  assert.equal(fresh.getQueryData(['search', 'love']), undefined);
  fresh.clear();
});
