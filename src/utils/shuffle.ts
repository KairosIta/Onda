/**
 * Fisher-Yates, per il pulsante "Casuale" delle raccolte: mescola la
 * lista *prima* di caricarla, cosi' la coda canonica e' gia' l'ordine di
 * ascolto e la schermata Coda dice il vero senza avvertenze.
 *
 * E' un meccanismo diverso dall'interruttore shuffle del player, che e'
 * nativo (`setShuffleEnabled`) e lascia la coda com'e'.
 */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
