/**
 * Geometria del riordino a trascinamento nella Coda. Le righe hanno
 * altezza fissa, quindi tutto si riduce a divisioni intere: nessuna
 * misura da chiedere al layout, e la regola si verifica in Node.
 *
 * Entrambe le funzioni girano anche sul thread UI (dentro
 * `useAnimatedStyle` e `onEnd` del gesto): da qui la direttiva `worklet`.
 */

/** Indice di arrivo di una riga partita da `from` e trascinata di `translationY` punti. */
export function dropIndex(
  from: number,
  translationY: number,
  rowHeight: number,
  length: number,
): number {
  'worklet';
  const target = from + Math.round(translationY / rowHeight);
  return Math.min(Math.max(0, target), length - 1);
}

/**
 * Di quanto si sposta la riga `index` mentre quella in `from` viene tenuta
 * sopra la posizione `to`: le righe fra le due scalano di un posto per
 * fare spazio, le altre restano ferme. La riga trascinata segue il dito e
 * non passa da qui.
 */
export function rowShift(index: number, from: number, to: number, rowHeight: number): number {
  'worklet';
  if (from === to || index === from) return 0;
  if (from < to && index > from && index <= to) return -rowHeight;
  if (from > to && index >= to && index < from) return rowHeight;
  return 0;
}
