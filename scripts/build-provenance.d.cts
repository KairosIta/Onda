/** Tipi di build-provenance.cjs, che e' CommonJS per poter stare anche dentro app.config.ts. */

export declare const SHORT_COMMIT_LENGTH: number;

export interface Provenance {
  /** Commit intero, o `null` se Git non e' disponibile (archivio, CI senza storia). */
  commit: string | null;
  /** Modifiche non committate al momento della build. */
  dirty: boolean;
}

/**
 * `personal` e' la build locale firmata con la chiave di debug, `release`
 * quella della pipeline ufficiale.
 */
export type Channel = 'personal' | 'release';

export type InstallState = 'assente' | 'allineato' | 'diverso';

export interface InstallComparison {
  state: InstallState;
  installed: string | null;
  expected: string;
}

export declare function shortCommit(commit: string | null): string | null;
export declare function versionName(
  declared: string,
  channel: Channel,
  provenance: Provenance,
): string;
export declare function compareInstalled(
  installed: string | null,
  expected: string,
): InstallComparison;
