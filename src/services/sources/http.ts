/**
 * Il tetto di tempo di una richiesta di catalogo.
 *
 * `fetch` non ne ha uno: una rete che accetta la connessione ma non
 * risponde mai — il portale captive di un hotel, il Wi-Fi che sta
 * cadendo — lascia la promise sospesa per sempre. React Query non ha
 * niente da ritentare, perche' il tentativo non e' mai finito, e la
 * schermata resta sulla sagoma di caricamento: nessun errore, nessun
 * Riprova, nessun modo di accorgersi che non arrivera' niente.
 *
 * Con il tetto quella stessa situazione diventa un fallimento normale,
 * che la federazione sa gia' descrivere e le schermate sanno gia'
 * mostrare.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Il messaggio contiene la parola che `federation.describeFailure`
 * riconosce come guasto di rete: a schermo diventa "rete non
 * raggiungibile", come una risoluzione DNS fallita, che per chi ascolta
 * e' la stessa cosa.
 */
export function timeoutMessage(label: string, timeoutMs: number): string {
  return `${label}: nessuna risposta entro ${Math.round(timeoutMs / 1000)}s (timeout di rete)`;
}

/**
 * Una richiesta annullata da chi l'aveva fatta, non un guasto: nessuno
 * aspetta piu' la risposta, quindi nessuno la mostra. Ha un nome suo
 * perche' chi la riceve possa riconoscerla senza leggere il messaggio.
 */
export function cancelledError(label: string): Error {
  const error = new Error(`${label}: richiesta annullata`);
  error.name = 'AbortError';
  return error;
}

export interface RequestOptions {
  timeoutMs?: number;
  /** Il segnale di chi aspetta la risposta (vedi `ListParams.signal`). */
  signal?: AbortSignal;
  /**
   * Le credenziali che possono viaggiare in un header, come la API key
   * Audius: fuori dall'URL non finiscono negli URL salvati ne' nei log.
   */
  headers?: Record<string, string>;
}

/**
 * L'unico punto in cui Onda parla con un catalogo.
 *
 * Il timer copre anche la lettura del corpo, non solo l'attesa degli
 * header: una risposta che comincia ad arrivare e poi si interrompe a
 * meta' appenderebbe `res.json()` esattamente come si appendeva `fetch`.
 *
 * Due cose possono interrompere la richiesta, e vanno dette diverse: il
 * tetto di tempo e' un guasto di rete da mostrare, l'annullamento di chi
 * l'aveva chiesta no.
 */
export async function fetchJSON<T>(
  label: string,
  url: string,
  { timeoutMs = REQUEST_TIMEOUT_MS, signal, headers }: RequestOptions = {},
): Promise<T> {
  // Gia' annullata (una ricerca superata fra un tentativo e l'altro): non
  // si apre nemmeno la connessione.
  if (signal?.aborted) throw cancelledError(label);

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const cancel = (): void => controller.abort();
  signal?.addEventListener('abort', cancel);

  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    if (!res.ok) throw new Error(`${label} ha risposto ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    // L'abort arriva come errore generico e cambia forma fra Hermes e
    // Node: la domanda affidabile non e' come si chiama l'eccezione, ma
    // chi l'ha interrotta.
    if (timedOut) throw new Error(timeoutMessage(label, timeoutMs));
    if (signal?.aborted) throw cancelledError(label);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
