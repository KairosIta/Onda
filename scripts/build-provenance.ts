/**
 * Da quale sorgente viene una build, e come si scrive.
 *
 * Il nome di versione dichiarato in `app.json` dice a quale release
 * appartiene l'app, non da quale commit e' stata costruita: fra due build
 * personali dello stesso pomeriggio e' identico. Sul telefono resta solo
 * quello, quindi "ho l'ultima versione?" non era una domanda con risposta.
 *
 * Da qui esce il pezzo che manca: il commit, se il worktree era sporco e
 * quando. Modulo puro, senza Git ne' filesystem, cosi' `app.config.ts`, lo
 * script di confronto e i test leggono la stessa regola.
 */

/** Quanto commit basta per riconoscerlo a occhio restando univoco. */
export const SHORT_COMMIT_LENGTH = 7;

export interface Provenance {
  /** Commit intero, o `null` se Git non e' disponibile (tarball, CI senza storia). */
  commit: string | null;
  /** Modifiche non committate al momento della build. */
  dirty: boolean;
}

/**
 * `personal` e' la build locale firmata con la chiave di debug, `release`
 * quella della pipeline ufficiale. Solo la prima porta il commit nel nome
 * di versione: la release ha il suo numero, ed e' quello che deve leggersi
 * in un negozio o in un bug report.
 */
export type Channel = 'personal' | 'release';

export const shortCommit = (commit: string | null): string | null =>
  commit ? commit.slice(0, SHORT_COMMIT_LENGTH) : null;

/**
 * Il nome di versione che finisce nel manifest Android, e quindi in
 * `adb shell dumpsys package`. Per una build personale diventa
 * `0.2.0+1a2b3c4`, con `.dirty` in coda se il worktree non era pulito:
 * basta a dire, da fuori e senza aprire l'app, che cosa c'e' installato.
 */
export function versionName(
  declared: string,
  channel: Channel,
  { commit, dirty }: Provenance,
): string {
  if (channel === 'release') return declared;
  const short = shortCommit(commit);
  if (!short) return `${declared}+sconosciuto`;
  return dirty ? `${declared}+${short}.dirty` : `${declared}+${short}`;
}

/**
 * Confronto fra cio' che e' installato e cio' che il repository ha adesso.
 * `installed` e' il nome di versione letto dal telefono; `expected` quello
 * che una build fatta ora produrrebbe.
 */
export type InstallState = 'assente' | 'allineato' | 'diverso';

export function compareInstalled(
  installed: string | null,
  expected: string,
): { state: InstallState; installed: string | null; expected: string } {
  if (!installed) return { state: 'assente', installed, expected };
  return { state: installed === expected ? 'allineato' : 'diverso', installed, expected };
}
