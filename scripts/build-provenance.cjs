/**
 * Da quale sorgente viene una build, e come si scrive.
 *
 * Il nome di versione dichiarato in `app.json` dice a quale release
 * appartiene l'app, non da quale commit e' stata costruita: fra due build
 * personali dello stesso pomeriggio e' identico. Sul telefono resta solo
 * quello, quindi "ho l'ultima versione?" non era una domanda con risposta.
 *
 * Da qui esce il pezzo che manca: il commit, se il worktree era sporco e
 * quando. Senza Git ne' filesystem, cosi' `app.config.ts`, lo script di
 * confronto e i test leggono la stessa regola.
 *
 * CommonJS e non TypeScript di proposito. `app.config.ts` lo carica
 * Expo, che dal SDK 57 non transpila piu' i moduli importati e si affida
 * alla rimozione dei tipi di Node: presente dalla 22.18, assente sulla
 * 22.15 che il progetto dichiara come minimo e che la CI usa. Un modulo
 * .cjs si carica su entrambe. I tipi stanno in build-provenance.d.cts.
 */

/** Quanto commit basta per riconoscerlo a occhio restando univoco. */
const SHORT_COMMIT_LENGTH = 7;

const shortCommit = (commit) => (commit ? commit.slice(0, SHORT_COMMIT_LENGTH) : null);

/**
 * Il nome di versione che finisce nel manifest Android, e quindi in
 * `adb shell dumpsys package`. Per una build personale diventa
 * `0.2.0+1a2b3c4`, con `.dirty` in coda se il worktree non era pulito:
 * basta a dire, da fuori e senza aprire l'app, che cosa c'e' installato.
 *
 * La release ufficiale tiene il numero pulito: e' quello che deve leggersi
 * in un negozio o in una segnalazione.
 */
function versionName(declared, channel, provenance) {
  if (channel === 'release') return declared;
  const short = shortCommit(provenance.commit);
  if (!short) return `${declared}+sconosciuto`;
  return provenance.dirty ? `${declared}+${short}.dirty` : `${declared}+${short}`;
}

/**
 * Confronto fra cio' che e' installato e cio' che il repository ha adesso.
 * `installed` e' il nome di versione letto dal telefono, `expected` quello
 * che una build fatta ora produrrebbe.
 */
function compareInstalled(installed, expected) {
  if (!installed) return { state: 'assente', installed, expected };
  return { state: installed === expected ? 'allineato' : 'diverso', installed, expected };
}

module.exports = { SHORT_COMMIT_LENGTH, shortCommit, versionName, compareInstalled };
