import {
  type DehydratedState,
  QueryClient,
  defaultShouldDehydrateQuery,
  dehydrate,
  focusManager,
  hydrate,
} from '@tanstack/react-query';
import { AppState } from 'react-native';
import {
  QUERY_CACHE_MAX_AGE_MS,
  isPersistableKey,
  loadQueryCache,
  pruneQueryCache,
} from './queryPersistenceSchema';
import { readJSON, writeJSON } from './storage';

/**
 * Il client di React Query con la cache che sopravvive alla chiusura.
 *
 * Senza, ogni avvio a freddo era una sagoma finche' Audius e Jamendo non
 * rispondevano. Ora il trending e le pagine gia' aperte tornano da MMKV
 * prima del primo render — MMKV e' sincrono, quindi la reidratazione
 * avviene qui, al caricamento del modulo, e nessuna query fa in tempo a
 * partire vuota — mentre `staleTime` le manda comunque a rinfrescarsi.
 *
 * Fatto a mano con `dehydrate`/`hydrate` invece del pacchetto persister
 * ufficiale: quello e' pensato per storage asincroni e porta un provider
 * che sospende il render; con MMKV bastano trenta righe e zero dipendenze.
 */

const KEY = 'query-cache.v1';
/** Le scritture si accorpano: una pagina che arriva e' tre eventi di cache. */
const WRITE_DELAY_MS = 1000;

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        retry: 1,
        // Pari all'eta' massima su disco: una query sfrattata dalla
        // memoria sparirebbe anche dal file al salvataggio successivo.
        gcTime: QUERY_CACHE_MAX_AGE_MS,
      },
    },
  });

  const saved = loadQueryCache(readJSON(KEY), Date.now());
  // `queryPersistenceSchema` sta fuori da TanStack apposta, cosi' la
  // potatura si verifica in Node: descrive i campi che legge, non tutta la
  // forma disidratata. Da 5.102 `hydrate` non accetta piu' `unknown` e
  // pretende quella forma intera, che sul disco c'e' davvero — l'ha
  // scritta `dehydrate` — ma che il tipo del modulo puro non dichiara. Il
  // cast dice esattamente questo; a garantire il contenuto e' il controllo
  // di forma che `loadQueryCache` fa a ogni voce.
  if (saved) hydrate(client, saved as unknown as DehydratedState);

  persist(client);
  bindFocus();
  return client;
}

function persist(client: QueryClient): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    timer = null;
    const state = dehydrate(client, {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) && isPersistableKey(query.queryKey),
    });
    writeJSON(KEY, pruneQueryCache(state, { now: Date.now() }));
  };

  client.getQueryCache().subscribe((event) => {
    if (event.type !== 'added' && event.type !== 'updated' && event.type !== 'removed') return;
    if (!isPersistableKey(event.query.queryKey)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, WRITE_DELAY_MS);
  });

  // In uscita dall'app non si aspetta il ritardo: se il processo muore
  // subito dopo, l'ultima pagina arrivata resterebbe fuori dal file.
  AppState.addEventListener('change', (status) => {
    if (status !== 'active' && timer) {
      clearTimeout(timer);
      flush();
    }
  });
}

/**
 * React Query non sa cos'e' "tornare in primo piano" su un telefono:
 * glielo dice AppState. Cosi' un trending scaduto mentre l'app era dietro
 * si rinfresca da solo appena si riapre, senza pull-to-refresh.
 */
function bindFocus(): void {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (status) => {
      handleFocus(status === 'active');
    });
    return () => sub.remove();
  });
}
