import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { embeddedCredentialErrors, resolveReleaseEnvironment } from './release-policy.ts';

/** Valori per la build e diagnostica che contiene soltanto nomi, mai valori. */
export function readBuildEnvironment(
  root: string,
  processValues: Readonly<Record<string, string | undefined>>,
) {
  // Si controllano anche le varianti di sviluppo/test e i valori oscurati:
  // una credenziale rimasta in un file non diventa sicura per precedenza.
  const files = new Map(
    readdirSync(root, { withFileTypes: true })
      .filter(
        (entry) =>
          (entry.isFile() || entry.isSymbolicLink()) && /^\.env(?:\..+)?$/u.test(entry.name),
      )
      .map((entry) => [entry.name, parseEnv(readFileSync(join(root, entry.name), 'utf8'))]),
  );
  // Ordine Expo, dal meno al piu' prioritario; l'ambiente esplicito prevale.
  const values = Object.assign(
    {},
    ...['.env', '.env.production', '.env.local', '.env.production.local'].map(
      (name) => files.get(name) ?? {},
    ),
  );
  return {
    environment: resolveReleaseEnvironment(values, processValues),
    credentialErrors: [
      ...embeddedCredentialErrors(processValues).map((error) => `ambiente: ${error}`),
      ...[...files]
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([name, contents]) =>
          embeddedCredentialErrors(contents).map((error) => `${name}: ${error}`),
        ),
    ],
  };
}
