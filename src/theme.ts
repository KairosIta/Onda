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

export const type = {
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.3 },
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
