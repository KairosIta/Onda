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
 * L'unico punto in cui Onda parla con un catalogo.
 *
 * Il timer copre anche la lettura del corpo, non solo l'attesa degli
 * header: una risposta che comincia ad arrivare e poi si interrompe a
 * meta' appenderebbe `res.json()` esattamente come si appendeva `fetch`.
 */
export async function fetchJSON<T>(
  label: string,
  url: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`${label} ha risposto ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    // L'abort arriva come errore generico e cambia forma fra Hermes e
    // Node: la domanda affidabile non e' come si chiama l'eccezione, ma
    // se siamo stati noi a interromperla.
    if (controller.signal.aborted) throw new Error(timeoutMessage(label, timeoutMs));
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
