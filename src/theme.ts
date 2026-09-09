/**
 * Palette: inchiostro blu freddo con un unico accento ambra.
 * L'ambra e' l'unico colore saturo dell'app: se compare, significa
 * "questo sta suonando". Tutto il resto resta neutro.
 */
export const colors = {
  bg: '#0E1116',
  surface: '#171B23',
  surfaceHigh: '#212734',
  border: '#2A3140',
  text: '#ECEFF4',
  textMuted: '#8B94A7',
  accent: '#FFB03A',
  accentDim: '#4A3A1E',
  danger: '#E5735C',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 4, md: 8, lg: 12, pill: 999 } as const;

/**
 * Tipografia di brand: Manrope, incorporata nel pacchetto nativo dal config
 * plugin di expo-font (vedi app.json). Su Android la famiglia XML "Manrope"
 * risolve il peso da `fontWeight`, quindi i token restano leggibili e, se
 * il file mancasse, Android ricadrebbe da solo sul font di sistema.
 *
 * Incorporato e non caricato a runtime: niente attesa all'avvio e niente
 * testo che cambia faccia un istante dopo. E' anche l'unico modo di avere
 * la stessa identita' su ogni telefono: con il font di sistema Onda era
 * Roboto su un Pixel e un serif su un Motorola.
 */
export const fontFamily = 'Manrope';

export const type = {
  display: { fontFamily, fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontFamily, fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
  body: { fontFamily, fontSize: 15, fontWeight: '500' as const },
  /** Bottoni ed etichette di azione: un peso in piu' del corpo. */
  label: { fontFamily, fontSize: 15, fontWeight: '600' as const },
  caption: { fontFamily, fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.2 },
  /**
   * Cifre a larghezza fissa per durate e contatori: senza, "0:37" si
   * allarga e si stringe a ogni secondo e il tempo accanto allo slider balla.
   */
  tabular: { fontVariant: ['tabular-nums' as const] },
} as const;

/**
 * Molla condivisa dai feedback di pressione e dal player: rapida, senza
 * rimbalzo visibile. Una sola, cosi' tutto quello che si tocca risponde
 * allo stesso modo.
 */
export const motion = {
  press: { damping: 18, stiffness: 340, mass: 0.6 },
  pressScale: 0.96,
} as const;

/**
 * Durata leggibile. Le ore compaiono solo quando ci sono: `3:07` resta
 * `3:07` e non diventa `0:03:07`, che a colpo d'occhio si legge come tre
 * secondi. Oltre l'ora minuti e secondi passano a due cifre, altrimenti
 * `1:5:09` sarebbe ambiguo.
 *
 * Serve davvero: nel trending Audius ci sono set e puntate radio da piu'
 * di un'ora, e senza il campo ore uscivano come `70:01`.
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
