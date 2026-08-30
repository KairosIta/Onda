/**
 * Cosa dire sopra l'elenco della coda.
 *
 * Sta qui e non dentro la schermata perche' e' la parte che decide se
 * l'app sta dicendo la verita': con lo shuffle nativo l'elenco che si
 * vede non e' l'ordine di ascolto, e stabilire quando ammetterlo si
 * verifica senza un dispositivo. Stesso motivo di `playbackPolicy` e
 * `federation`.
 *
 * Perche' non mostriamo semplicemente l'ordine giusto: RNTP tiene la
 * permutazione in un `playOrder` privato e non espone alcun accessore
 * (`isShuffleEnabled` dice solo se e' attivo). La coda canonica e
 * l'indice attivo restano quelli di partenza. Finche' resta cosi',
 * l'unica scelta onesta e' dichiarare che l'elenco non e' l'ordine.
 *
 * Nota: il pulsante "Casuale" delle raccolte e' un'altra cosa. Quello
 * mescola l'array prima di caricarlo (vedi `shuffled`), quindi la coda
 * canonica *e'* gia' l'ordine di ascolto e qui non c'e' niente da
 * avvertire. Il caso ambiguo e' solo l'interruttore del player.
 */

export interface QueueSummary {
  /** Riga sotto il titolo. */
  subtitle: string;
  /** Avviso, presente solo quando l'elenco non e' l'ordine di ascolto. */
  notice?: string;
  /** Azione di svuotamento; assente quando non c'e' niente da togliere. */
  clearLabel?: string;
  /**
   * Se attenuare le tracce prima di quella attiva.
   *
   * Con lo shuffle l'indice canonico non dice niente su cosa e' stato
   * ascoltato: marcarle come gia' sentite era la meta' piu' ingannevole
   * del difetto, perche' inventava una cronologia mai avvenuta.
   */
  dimPlayed: boolean;
}

export interface QueueState {
  length: number;
  /** Indice canonico della traccia in riproduzione, `null` se ignoto. */
  activeIndex: number | null;
  shuffle: boolean;
}

const brani = (n: number): string => `${n} ${n === 1 ? 'brano' : 'brani'}`;

const ORDINE_CASUALE = "L'elenco è l'ordine originale: il prossimo brano non è quello sotto.";

export function describeQueue({ length, activeIndex, shuffle }: QueueState): QueueSummary {
  if (length === 0) return { subtitle: '', dimPlayed: false };

  // Coda carica ma nessuna traccia attiva: non esiste un "questo" a cui
  // riferirsi, quindi niente "dopo questo" e niente svuotamento — quello
  // taglia a partire dall'indice attivo, che qui non c'e'.
  if (activeIndex === null) {
    return {
      subtitle: shuffle ? `${brani(length)} in coda · ordine casuale` : `${brani(length)} in coda`,
      notice: shuffle ? ORDINE_CASUALE : undefined,
      dimPlayed: false,
    };
  }

  // C'e' qualcosa sotto la riga attiva? Vale in entrambi i modi: e'
  // una proprieta' dell'elenco a schermo, non dell'ordine di ascolto.
  const below = length - activeIndex - 1;

  if (shuffle) {
    return {
      subtitle: `${brani(length)} in coda · ordine casuale`,
      notice: ORDINE_CASUALE,
      // Non "i successivi": con lo shuffle non sappiamo quali siano. Toglie
      // quello che sta sotto nell'elenco, e l'etichetta dice quello.
      clearLabel: below > 0 ? 'Svuota da qui in giù' : undefined,
      dimPlayed: false,
    };
  }

  return {
    subtitle: below > 0 ? `${brani(below)} dopo questo` : 'Ultimo brano',
    clearLabel: below > 0 ? 'Svuota i successivi' : undefined,
    dimPlayed: true,
  };
}
