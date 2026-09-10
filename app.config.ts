/// <reference types="node" />

import { execFileSync } from 'node:child_process';
import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  type Channel,
  type Provenance,
  shortCommit,
  versionName,
} from './scripts/build-provenance.cjs';

/**
 * `app.json` resta la fonte di verita' dell'identita' di release: version,
 * versionCode, package, plugin. Questo file non la sostituisce, la
 * arricchisce con cio' che `app.json`, essendo statico, non puo' sapere:
 * da quale commit sta nascendo questa build.
 *
 * Serve a una domanda che prima non aveva risposta: "sul telefono ho
 * l'ultima versione?". Con version e versionCode fermi fra due build dello
 * stesso pomeriggio, ne' `adb` ne' la schermata Informazioni potevano
 * dirlo.
 *
 * Gli script che leggono `app.json` come JSON (personal, release,
 * verify-signing) continuano a vedere i valori dichiarati: il commit vive
 * solo nel manifest costruito e in `extra`.
 */

function git(...args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Nessun Git, o sorgente scaricata come archivio: la build resta
    // possibile, dira' soltanto di non conoscere la propria provenienza.
    return null;
  }
}

function provenance(): Provenance {
  const commit = git('rev-parse', 'HEAD');
  // `--porcelain` vuoto significa worktree pulito. Se Git non risponde non
  // si finge pulito: senza commit la provenienza e' comunque sconosciuta.
  const status = commit === null ? null : git('status', '--porcelain');
  return { commit, dirty: Boolean(status && status.length > 0) };
}

/**
 * La build personale si riconosce dalla variabile che `scripts/personal.ts`
 * esporta per impedire la firma ufficiale: la stessa che tiene al sicuro il
 * maintainer vale anche come etichetta del canale.
 */
const channel = (): Channel =>
  process.env.ONDA_FORCE_DEBUG_RELEASE === '1' ? 'personal' : 'release';

export default ({ config }: ConfigContext): ExpoConfig => {
  const declared = config.version ?? '0.0.0';
  const built = provenance();
  const kind = channel();

  return {
    ...config,
    name: config.name ?? 'Onda',
    slug: config.slug ?? 'onda',
    version: versionName(declared, kind, built),
    extra: {
      ...config.extra,
      build: {
        channel: kind,
        declaredVersion: declared,
        commit: built.commit,
        shortCommit: shortCommit(built.commit),
        dirty: built.dirty,
        builtAt: new Date().toISOString(),
      },
    },
  };
};
