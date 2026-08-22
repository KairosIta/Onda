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

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
