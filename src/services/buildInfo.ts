import Constants from 'expo-constants';

/**
 * Che cosa e' esattamente questa copia di Onda, per la schermata
 * Informazioni. I valori li mette `app.config.ts` al momento della build;
 * qui si legge e si formatta, con un ripiego se il campo manca (una build
 * fatta prima che lo schema esistesse, o un config caricato a mano).
 */

export interface BuildInfo {
  /** Versione dichiarata in app.json, senza il commit attaccato. */
  version: string;
  /** Numero di build Android, quello che Android confronta per aggiornare. */
  versionCode: number | null;
  /** `personal` per la build locale, `release` per quella ufficiale. */
  channel: string;
  shortCommit: string | null;
  dirty: boolean;
  builtAt: Date | null;
}

interface RawBuild {
  channel?: unknown;
  declaredVersion?: unknown;
  shortCommit?: unknown;
  dirty?: unknown;
  builtAt?: unknown;
}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function readBuildInfo(): BuildInfo {
  const config = Constants.expoConfig;
  const raw = (config?.extra?.build ?? {}) as RawBuild;
  const builtAt = asString(raw.builtAt);
  const parsed = builtAt ? new Date(builtAt) : null;

  return {
    version: asString(raw.declaredVersion) ?? config?.version ?? '0.0.0',
    versionCode:
      typeof config?.android?.versionCode === 'number' ? config.android.versionCode : null,
    channel: asString(raw.channel) ?? 'sconosciuto',
    shortCommit: asString(raw.shortCommit),
    dirty: raw.dirty === true,
    builtAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
  };
}

/**
 * Una riga sola, leggibile ad alta voce a chi ti chiede che build hai:
 * "build 2, personale, commit 1a2b3c4 del 10 settembre 2026".
 */
export function describeBuild(info: BuildInfo): string {
  const parts: string[] = [];
  if (info.versionCode !== null) parts.push(`build ${info.versionCode}`);
  parts.push(info.channel === 'personal' ? 'personale' : info.channel);
  if (info.shortCommit)
    parts.push(`commit ${info.shortCommit}${info.dirty ? ' (modificato)' : ''}`);
  if (info.builtAt) {
    parts.push(
      `del ${info.builtAt.toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`,
    );
  }
  return parts.join(', ');
}
