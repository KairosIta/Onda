/**
 * Che cosa e' esattamente questa copia di Onda, letto da quello che
 * `app.config.ts` ha scritto nel manifest al momento della build.
 *
 * Sta separato da `buildInfo` per la ragione di sempre — la stessa che
 * divide `storageSchema` da `storage`: qui non si tocca nessun modulo
 * nativo, quindi la lettura difensiva e la frase che finisce sotto gli
 * occhi di chi apre Informazioni si verificano in Node. Il modulo
 * accanto fa solo la parte che non si puo' verificare li': chiedere il
 * manifest a expo-constants.
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

/**
 * Il minimo che serve del manifest. Descritto qui invece di importare i
 * tipi di Expo: sono l'unica cosa che questo modulo dovrebbe a un
 * pacchetto che non puo' caricare.
 */
export interface BuildManifest {
  version?: string;
  android?: { versionCode?: number };
  extra?: { build?: unknown };
}

interface RawBuild {
  channel?: unknown;
  declaredVersion?: unknown;
  shortCommit?: unknown;
  dirty?: unknown;
  builtAt?: unknown;
}

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * Niente qui si fida del manifest: un APK compilato prima che questo
 * schema esistesse non ha `extra.build`, e un config caricato a mano puo'
 * avere qualunque cosa. Ogni campo ha un ripiego, e la schermata
 * Informazioni resta leggibile invece di non aprirsi.
 */
export function parseBuildInfo(manifest: BuildManifest | null | undefined): BuildInfo {
  const raw = (manifest?.extra?.build ?? {}) as RawBuild;
  const builtAt = asString(raw.builtAt);
  const parsed = builtAt ? new Date(builtAt) : null;

  return {
    version: asString(raw.declaredVersion) ?? manifest?.version ?? '0.0.0',
    versionCode:
      typeof manifest?.android?.versionCode === 'number' ? manifest.android.versionCode : null,
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
