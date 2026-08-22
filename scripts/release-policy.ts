import { isAbsolute, relative, resolve } from 'node:path';

export const REQUIRED_SIGNING_KEYS = [
  'storeFile',
  'storePassword',
  'keyAlias',
  'keyPassword',
] as const;

export type ReleaseEnvironment = NodeJS.ProcessEnv & { NODE_ENV: string };

export interface ReleaseIdentity {
  package: string;
  certificateSha256: string;
}

const PLACEHOLDER_PATTERN = /(inserisci|changeme|replace[_ -]?me|your[_ -]|example)/i;

export function parseKeyValueFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }
    values[match[1]] = value;
  }

  return values;
}

export function resolveReleaseEnvironment(
  fileValues: Record<string, string>,
  processValues: Readonly<Record<string, string | undefined>>,
): ReleaseEnvironment {
  return { ...fileValues, ...processValues, NODE_ENV: 'production' };
}

export function validateJamendoClientId(value: string | undefined): string[] {
  if (!value?.trim()) return ['EXPO_PUBLIC_JAMENDO_CLIENT_ID non configurato.'];
  if (PLACEHOLDER_PATTERN.test(value)) {
    return ['EXPO_PUBLIC_JAMENDO_CLIENT_ID contiene ancora un valore di esempio.'];
  }
  return [];
}

export function validateSigningProperties(
  values: Record<string, string>,
  credentialsDir: string,
): string[] {
  const errors: string[] = [];
  const missing = REQUIRED_SIGNING_KEYS.filter((key) => !values[key]?.trim());
  if (missing.length) errors.push(`Proprieta' di firma mancanti: ${missing.join(', ')}.`);

  const storeFile = values.storeFile?.trim();
  if (storeFile) {
    const resolvedCredentials = resolve(credentialsDir);
    const resolvedStore = resolve(resolvedCredentials, storeFile);
    const storeRelative = relative(resolvedCredentials, resolvedStore);
    if (isAbsolute(storeFile) || storeRelative.startsWith('..') || isAbsolute(storeRelative)) {
      errors.push('storeFile deve indicare un file interno a credentials/.');
    }
  }

  return errors;
}

export function normalizeCertificateSha256(value: string): string {
  return value.replaceAll(':', '').trim().toLowerCase();
}

export function validateReleaseIdentity(
  identity: ReleaseIdentity,
  expectedPackage: string,
): string[] {
  const errors: string[] = [];
  const digest = normalizeCertificateSha256(identity.certificateSha256 ?? '');

  if (identity.package !== expectedPackage) {
    errors.push(
      `Il package della firma attesa (${identity.package || 'mancante'}) non coincide con ${expectedPackage}.`,
    );
  }
  if (!/^[0-9a-f]{64}$/u.test(digest)) {
    errors.push("L'impronta SHA-256 attesa del certificato non e' valida.");
  }

  return errors;
}
